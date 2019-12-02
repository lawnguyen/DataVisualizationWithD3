const margin = {top: 0, right: 10, bottom: 200, left: 10};
const width = 760, height = 640;

// The columns from the dataset that we are interested in

let canvas = d3.select('#chart')
    .append('svg')
       .attr('width', width + margin.left + margin.right)
       .attr('height', height + margin.top + margin.bottom)
    .append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

let legendContainer = d3.select('svg').append('g')
    .attr('transform', 'translate(' + 100 + ',0)');

let bicyclistTotal = 0;
let bicyclistPerArea = [];

d3.json('../../data/geoJson/Community_Boundaries.geojson', (jsonData) => {
    d3.csv('../../data/Modes_of_Travel.csv', (d, i, columns) => {
        return processCsvRow(d, i, columns);
    }, (error, csvData) => {
        if (error) throw error;

        // Create a dictionary mapping comm_code to csvData for faster lookup
        let communities = {};
        csvData.forEach(community => {
            communities[community.comm_code] = community;
        });
        // Add a <g> element for each of the communities in the data
        let group = canvas.selectAll('g')
        .data(jsonData.features)
        .enter()
        .append('g')
          .attr('class', 'community')
          .attr('fill', (d) => {
            if (!(!!communities[d.properties.comm_code])) {
                // 'Disabled' color for communities we don't have data for
                return '#f7fbff';
            }

            return getAssignedColor(d.properties.comm_code, communities);
          });

        // Set the d3 geo projection and path
        const projection = d3.geoMercator().fitSize([width, height], jsonData);
        const path = d3.geoPath().projection(projection);

        // Append path to all the <g> elements
        let areas = group.append('path')
            .attr('d', path)
            .attr('class', 'area')

        // Add tooltip to the each community path element
        let tooltip = createTooltip();
        areas.on('mouseover', () => { tooltip.style('display', null); })
            .on('mouseout', () => { tooltip.style('display', 'none'); })
            .on('mousemove', function(d) {
                let dataIsAvailable = !!communities[d.properties.comm_code];
                let tooltipHeight = 20;
                let tooltipWidth = 0;
                let xPosition = d3.mouse(this)[0] + 10;
                let yPosition = d3.mouse(this)[1] + 20;
                tooltip.attr('transform', 'translate(' + xPosition + ',' + yPosition + ')');
                tooltip.select('text').text(d.properties.name);
                tooltipWidth = getTooltipWidth(d.properties.name, tooltipWidth);

                if (dataIsAvailable) {
                    tooltipHeight = 40;

                    tooltip.select('text')
                    .append('svg:tspan')
                    .attr('x', 0)
                    .attr('dy', 20)
                    .text(getAreaSum(d.properties.comm_code, communities) + 
                        ' people who live in this '+
                        getQuadrant(d.properties.comm_code,communities)+
                        ' quadrant bicycle to work')
                          .attr('x', 10);
                    tooltipWidth = 
                        getTooltipWidth(getAreaSum(d.properties.comm_code, communities) +
                            ' people who live in this '+
                            getQuadrant(d.properties.comm_code,communities)+
                            ' quadrant bicycle to work'
                            , tooltipWidth);
                } else {
                    tooltipHeight = 40;

                    tooltip.select('text')
                    .append('svg:tspan')
                    .attr('x', 0)
                    .attr('dy', 20)
                    .text('non-residential community')
                        .attr('x', 10);
                    tooltipWidth = 
                        getTooltipWidth('non-residential community', tooltipWidth);
                }

                tooltip.select('rect')
                    .attr('width', tooltipWidth)
                    .attr('height', tooltipHeight);
            });

        // Label for each community
        group.append('text')
            .attr('x', (d) => { return path.centroid(d)[0] })
            .attr('y', (d) => { return path.centroid(d)[1] })
            .attr('text-anchor', 'middle')
            .attr('class', 'text-label')
            .text(d => { return d.properties.comm_code });

        // Label for each community
        group.append('text')
            .attr('x', (d) => { return path.centroid(d)[0] })
            .attr('y', (d) => { return path.centroid(d)[1] })
            .attr('text-anchor', 'middle')
            .attr('class', 'text-label')
            .text(d => { return d.properties.comm_code });

        // legend label
        legendContainer.append('text')
            .attr('x', width - 200)
            .attr('y', 9.5)
            .attr('font-size', 9)
            .attr('dy', '0.32em')
            .attr('class', 'legend-text')
            .text('PERCENTAGE OF');
        legendContainer.append('text')
            .attr('x', width - 200)
            .attr('y', 22)
            .attr('font-size', 9)
            .attr('dy', '0.32em')
            .attr('class', 'legend-text')
            .text('CYCLING TO WORK');
        legendContainer.append('text')
            .attr('x', width - 200)
            .attr('y', 34.5)
            .attr('font-size', 9)
            .attr('dy', '0.32em')
            .attr('class', 'legend-text')
            .text('(OF TOTAL THAT CYCLE');
        legendContainer.append('text')
            .attr('x', width - 200)
            .attr('y', 47)
            .attr('font-size', 9)
            .attr('dy', '0.32em')
            .attr('class', 'legend-text')
            .text('TO WORK IN CALGARY)');

        // create legend
        let legend = legendContainer.append('g')
            .attr('font-family', 'sans-serif')
            .attr('font-size', 10)
            .attr('transform', 'translate(0, 24)')  // Make space for the legend title
            .attr('text-anchor', 'end')
            .selectAll('g')
            .data([
                '<5%', 
                '5.0-9.9%', 
                '10.0-14.9%', 
                '15.0-19.9%', 
                '20.0-24.9%', 
                '25.0-29.9%', 
                '30.0-34.9%', 
                '>35.0%', 
                'non-residential'
            ])
            .enter()
            .append('g')
              .attr('transform', (d, i) => { 
                  return 'translate(0,' + i * 20 + ')'; 
                });

        // legend value colors
        legend.append('rect')
            .attr('x', width - 200)
            .attr('y', (d) => {
                if (d === 'non-residential') {
                    return 50;
                }
                return 30;
            })
            .attr('width', 16)
            .attr('height', (d) => {
                if (d === 'non-residential') {
                    return 16;
                }
                return 20;
            })
            .attr('stroke-width', (d) => {
                if (d === 'non-residential') {
                    return 0.5;
                }
                return 0;
            })
            .attr('stroke', (d) => {
                if (d === 'non-residential') {
                    return 'black';
                }
                return 'white';
            })
            .attr('fill', (d) => {
                switch (d) {
                    case '<5%': 
                        return '#ACDF87';
                    case '5.0-9.9%':
                        return '#A4DE02';
                    case '10.0-14.9%':
                        return '#63C429';
                    case '15.0-19.9%':
                        return '#459F1D';
                    case '20.0-24.9%':
                        return '#308308';
                    case '25.0-29.9%':
                        return '#31701B';
                    case '30.0-34.9%':
                        return '#2F621D';
                    case '>35%':
                        return '#265517';
                    case 'non-residential':
                        return '#f7fff7';
                    default:
                        return '#265517';
                }
            });

        // legend value text
        legend.append('text')
            .attr('x', width - 185)
            .attr('y', (d) => {
                if (d === 'non-residential') {
                    return 59;
                }
                return 49;
            })
            .attr('dy', '0.32em')
            .attr('class', 'legend-text')
            .attr('text-anchor', 'end')
            .attr('xml:space', 'preserve')
            .text((d) => { 
                if (d === 'non-residential') {
                    return '  ' + d;
                }
                return ('-  ' + d); 
            });

        // Data source text
        legendContainer.append('text')
            .attr('x', 0)
            .attr('y', height)
            .attr('font-size', 12)
            .attr('dy', '0.32em')
            .attr('class', 'legend-text')
            .text('Source: Calgary Civic Census 2016');
    });
});

function createTooltip() {
    // create tooltip
    let tooltip = d3.select('svg')
        .append('g')
            .attr('class', 'tooltip')
            .style('display', 'none');

    tooltip.append('rect')
        .attr('fill', 'black')
        .style('opacity', 0.75);

    tooltip.append('text')
        .attr('x', 10)
        .attr('dy', '1.2em')
        .style('text-anchor', 'start')
        .attr('font-size', '12')
        .attr('fill', 'white')
        .attr('font-weight', 'bold');
    
    return tooltip;
}

function getTooltipWidth(text, currentTooltipWidth) {

    let tooltip = d3.select('svg')
        .append('g')
            .attr('class', 'tooltip')
            .style('display', 'none')
            .attr('id', '#temp');

    tooltip.append('text')
        .attr('x', 10)
        .attr('dy', '1.2em')
        .style('text-anchor', 'start')
        .attr('font-size', '12')
        .attr('fill', 'white')
        .attr('font-weight', 'bold');

    tooltip.select('text').text(text);

    const tempWidth = 
        Math.round(tooltip.select('text').node().getComputedTextLength()) + 20;
    if (tempWidth > currentTooltipWidth) {
        d3.select('#temp').remove();
        return tempWidth;
    }
    d3.select('#temp').remove();
    return currentTooltipWidth;
}

function getQuadrant(commCode, communities){
    return communities[commCode].quadrant;
}
function getAreaSum(commCode, communities){
    return bicyclistPerArea[getQuadrant(commCode,communities)];
}

function getAssignedColor(commCode, communities) {
    let percentCycling = getAreaSum(commCode, communities) / bicyclistTotal * 100;
    if (percentCycling < 5) {
        return '#ACDF87';
    } else if (5 <= percentCycling && percentCycling < 10) {
        return '#A4DE02';
    } else if (10 <= percentCycling && percentCycling < 15) {
        return '#63C429';
    } else if (15 <= percentCycling && percentCycling < 20) {
        return '#459F1D';
    } else if (20 <= percentCycling && percentCycling < 25) {
        return '#308308';
    } else if (25 <= percentCycling && percentCycling < 30) {
        return '#31701B';
    } else if (30 <= percentCycling && percentCycling < 35) {
        return '#2F621D';
    } else if (35 <= percentCycling) {
        return '#265517';
    }
    return '#ACDF87';
}

function processCsvRow(d, i, columns) {
    // Convert all quantative values to numbers
    d.bicycle = +d.bicycle.replace(/,/g, '');

    // sum up the totals of people in this community surveyed
    let s = d.bicycle;
    // sum up the total number of people who bicycle in this community
    bicyclistTotal += d.bicycle;
    if(isNaN(bicyclistPerArea[d.quadrant])) bicyclistPerArea[d.quadrant] = 0;
    bicyclistPerArea[d.quadrant] += d.bicycle;
    d.sum = s;
    return d;
}