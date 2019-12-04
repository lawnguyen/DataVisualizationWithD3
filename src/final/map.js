/**
 * Margin constants
 */
const mapMargin = { top: 10, right: 50, bottom: 10, left: 50 };
const plotMargin = { top: 5, right: 10, bottom: 100, left: 10 };
const legendMargin = { top: 0, right: 10, bottom: 50, left: 10 };

/**
 * SVG dimension constants
 */
const mapDimensions = { width: 640, height: 768 };
const plotDimensions = { width: 1320, height: 420 };
const legendDimensions = { width: 160, height: 220 };

// The columns from the dataset that we are interested in
const cols = [
    'bicycle',
    'carpool_dr',
    'carpool_pa',
    'drovealone',
    'motorcycle',
    'nowork',
    'transit',
    'walk',
    'work_home'
];

let selected = null;
let bicyclistTotal = 0;
let zoom;

/**
 * Create SVGs
 */
let mapSVG = d3.select('#map')
    .append('svg')
    .attr('width', mapDimensions.width + mapMargin.left + mapMargin.right)
    .attr('height', mapDimensions.height + mapMargin.top + mapMargin.bottom)
    .append('g')
    .attr('transform', 'translate(' + mapMargin.left + ',' + mapMargin.top + ')');

let plotSVG = d3.select('#graphPlot')
    .append('svg')
    .attr('width', plotDimensions.width + plotMargin.left + plotMargin.right)
    .attr('height', plotDimensions.height + plotMargin.top + plotMargin.bottom)
    .append('g')
    .attr('class', 'graphPlot')
    .attr('transform', 'translate(' + plotMargin.left + ',' + plotMargin.top + ')');

let legendSVG = d3.select('#legend')
    .append('svg')
    .attr('width', legendDimensions.width + legendMargin.left + legendMargin.right)
    .attr('height', legendDimensions.height + legendMargin.top + legendMargin.bottom)
    .append('g')
    .attr('transform', 'translate(' + legendMargin.left + ',' + legendMargin.top + ')');

let legendContainer = legendSVG.append('g');

d3.json('../../data/geoJson/Community_Boundaries.geojson', (jsonData) => {
    d3.csv('../../data/Modes_of_Travel.csv', (d, i, columns) => {
        return processCsvRow(d, i, columns);
    }, (error, csvData) => {
        if (error) throw error;

        const travelModes = csvData.columns.filter((c) => {
            return cols.includes(c);
        });
        travelModes.push('unavailable');

        // Create a dictionary mapping comm_code to csvData for faster lookup
        let communities = {};
        csvData.forEach(community => {
            communities[community.comm_code] = community;
        });

        /**
         * Map
         */
        // Add a <g> element for each of the communities in the data
        let group = mapSVG
            .selectAll('g')
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
        const projection = d3.geoMercator()
            .fitExtent([[70, 10], [mapDimensions.width-120, mapDimensions.height-10]], jsonData);
        const path = d3.geoPath().projection(projection);

        // Append path to all the <g> elements
        let areas = group.append('path')
            .attr('d', path)
            .attr('class', 'area')

        // Zoom and pan map
        zoom = d3.zoom().scaleExtent([1, 8]).on('zoom', () => {
            group.attr('transform', d3.event.transform)
        })
        mapSVG.call(zoom);

        // Add tooltip to the each community path element
        let tooltip = createTooltip('map');
        areas.on('mouseover', () => { tooltip.style('display', null); })
            .on('mouseout', () => { tooltip.style('display', 'none'); })
            .on('mousemove', function (d) {
                let dataIsAvailable = !!communities[d.properties.comm_code];
                let tooltipHeight = 20;
                let tooltipWidth = 0;
                let xPosition = d3.mouse(this)[0] + 10;
                let yPosition = d3.mouse(this)[1] + 20;
                tooltip.attr(
                    'transform', 'translate(' + xPosition + ',' + yPosition + ')');
                tooltip.select('text').text(d.properties.name);
                tooltipWidth = getTooltipWidth(d.properties.name, tooltipWidth);

                if (dataIsAvailable) {
                    tooltipHeight = 40;

                    tooltip.select('text')
                        .append('svg:tspan')
                        .attr('x', 0)
                        .attr('dy', 20)
                        .text(communities[d.properties.comm_code].bicycle +
                            ' people who live here bicycle to work')
                        .attr('x', 10);
                    tooltipWidth =
                        getTooltipWidth(communities[d.properties.comm_code].bicycle +
                            ' people who live here bicycle to work', tooltipWidth);
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
            .attr('font-weight', 'bold')
            .text(d => { return d.properties.comm_code });

        // Create legend
        createLegend();
            
        /**
         * Bar chart plots
         */
        let graphPlot = createPlot(communities);
        let tooltip2 = createTooltip('plots');
        graphPlot.selectAll('.bar')
            .on('mouseover', () => { tooltip2.style('display', null); })
            .on('mouseout', () => { tooltip2.style('display', 'none'); })
            .on('mousemove', function (d) {
                let dataIsAvailable = !!communities[d.comm_code];
                let tooltipHeight = 20;
                let tooltipWidth = 0;
                let xPosition = d3.mouse(this)[0] + 10;
                let yPosition = d3.mouse(this)[1] + 20;
                tooltip2.attr(
                    'transform', 'translate(' + xPosition + ',' + yPosition + ')');
                tooltip2.select('text').text(communities[d.comm_code].name);
                tooltipWidth =
                    getTooltipWidth(communities[d.comm_code].name, tooltipWidth);

                if (dataIsAvailable) {
                    tooltipHeight = 40;

                    tooltip2.select('text')
                        .append('svg:tspan')
                        .attr('x', 0)
                        .attr('dy', 20)
                        .text(communities[d.comm_code].bicycle +
                            ' people who live here bicycle to work')
                        .attr('x', 10);
                    tooltipWidth =
                        getTooltipWidth(communities[d.comm_code].bicycle +
                            ' people who live here bicycle to work', tooltipWidth);
                } else {
                    tooltipHeight = 40;

                    tooltip2.select('text')
                        .append('svg:tspan')
                        .attr('x', 0)
                        .attr('dy', 20)
                        .text('non-residential community')
                        .attr('x', 10);
                    tooltipWidth =
                        getTooltipWidth('non-residential community', tooltipWidth);
                }

                tooltip2.select('rect')
                    .attr('width', tooltipWidth)
                    .attr('height', tooltipHeight);
            });
    });
});

/**
 * Create a tooltip to be shown on hover
 * 
 * @param {string} chart - The chart to make a tooltip for
 */
function createTooltip(chart) {
    // create tooltip
    let tooltip = (chart === 'map' ? mapSVG : plotSVG)
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

/**
 * Calculate the tooltip width depending on the longest line of text that it contains
 * 
 * @param {string} text - One line of a string of text to be shown in the tooltip 
 * @param {number} currentTooltipWidth - The current max size of the tooltip
 */
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

/**
 * Creates the bar chart plot
 * 
 * @param {Object} communities - Object containing all community data
 */
function createPlot(communities) {
    // setup
    const MULTIPLIER = 4.3;
    let keys = Object.keys(communities);

    let data = [];
    let minY = 0, maxY = 0;
    for (let k in communities) {
        data.push({
            "comm_code": k,
            "bicycle": communities[k].bicycle,
            "index": keys.indexOf(k)
        });
        temp = communities[k].bicycle;
        if (minY >= temp) minY = temp;
        if (maxY <= temp) maxY = temp;
    }

    // setup x
    let xScale = d3.scaleBand().range([0, (keys.length - 1) * MULTIPLIER]), // value -> display
        xAxis = d3.axisBottom().scale(xScale).tickSize(0);
    // setup y
    let yValue = (d) => { return d.bicycle }, // data -> value
        yScale = 
            d3.scaleLinear().range([plotDimensions.height, 0]), // value -> display
        yAxis = d3.axisLeft().scale(yScale);

    xScale.domain(keys);
    yScale.domain([minY, Math.ceil(maxY / 50) * 50]);   // Round maxY up to nearest 50
    let graphPlot = plotSVG;

    // x-axis
    graphPlot.append("g")
        .attr("class", "x-axis")
        .attr("transform", "translate(50," + (plotDimensions.height) + ")")
        .call(xAxis)
        .selectAll("text")
        .each(function (d) {
            let ydiff = (keys.indexOf(d) * MULTIPLIER) % 3;
            // text
            d3.select(this).attr(
                "transform", "translate(0," + 20 * (ydiff + 1) + ") rotate(-90)");
            d3.select(this).attr('font-size', 8);
            // line
            d3.select(this.parentNode)
                .append("line")
                .attr("x1", 6 + 0.01 * 0.087 * xScale(d))
                .attr("x2", 6 + 0.01 * 0.087 * xScale(d))     //[0.087 = cos(-85)] %
                .attr("y1", 0)
                .attr("y2", 10 + 18 * ydiff)
                .attr("stroke-width", 0.4)
                .attr("stroke", "black");
        });
    graphPlot.append("text")
        .attr("class", "label")
        .attr("x", plotDimensions.width / 2)
        .attr("y", -6)
        .style("text-anchor", "end")
        .text("Communities");

    graphPlot.append("g")
        .attr("class", "y-axis")
        .attr("transform", "translate(50,0)")
        .call(yAxis);
    graphPlot.append("text")
        .attr("class", "label")
        .attr("transform", "translate(0,50) rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text("Amount of people riding Bicycle to work");

    // draw bars
    graphPlot.selectAll(".bar")
        .data(data).enter().append("rect")
        .attr("class", "bar")
        .attr("x", (d) => { return 50 + 2 + xScale(d.comm_code); })
        .attr("y", (d) => { return yScale(yValue(d)); })
        .attr("width", 5)
        .attr("height", (d) => { 
            return (plotDimensions.height) - yScale(yValue(d)); 
        })
        .attr('fill', (d) => {
            if (!(!!communities[d.comm_code].comm_code)) {
                // 'Disabled' color for communities we don't have data for
                return '#f7fbff';
            }
            return getAssignedColor(d.comm_code, communities);
        });
    return graphPlot;
}

/**
 * Create the legend
 */
function createLegend() {
    /* Legend */
    const x = 0;

    // legend label
    legendContainer.append('text')
        .attr('x', x)
        .attr('y', 10)
        .attr('dy', '0.32em')
        .attr('class', 'legend-text')
        .text('PERCENTAGE OF');
    legendContainer.append('text')
        .attr('x', x)
        .attr('y', 24)
        .attr('dy', '0.32em')
        .attr('class', 'legend-text')
        .text('CYCLING TO WORK');
    legendContainer.append('text')
        .attr('x', x)
        .attr('y', 38)
        .attr('dy', '0.32em')
        .attr('class', 'legend-text')
        .text('(OF TOTAL THAT CYCLE');
    legendContainer.append('text')
        .attr('x', x)
        .attr('y', 52)
        .attr('dy', '0.32em')
        .attr('class', 'legend-text')
        .text('TO WORK IN CALGARY)');

    // create legend
    let legend = legendContainer.append('g')
        .attr('font-family', 'sans-serif')
        .attr('font-size', 10)
        .attr('transform', 'translate(0, 32)')  // Make space for legend title
        .attr('text-anchor', 'end')
        .selectAll('g')
        .data([
            '<0.50%',
            '0.50-0.99%',
            '1.00-1.99%',
            '2.00-2.99%',
            '3.00-3.99%',
            '>4.00%',
            'non-residential'
        ])
        .enter()
        .append('g')
        .attr('transform', (d, i) => {
            return 'translate(0,' + i * 20 + ')';
        });

    // legend value colors
    legend.append('rect')
        .attr('x', x)
        .attr('y', (d) => {
            if (d === 'non-residential') {
                return 50;
            }
            return 31;
        })
        .attr('width', 16)
        .attr('height', (d) => {
            if (d === 'non-residential') {
                return 16;
            }
            return 21;
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
                case '<0.50%':
                    return '#c6dbef';
                case '0.50-0.99%':
                    return '#9ecae1';
                case '1.00-1.99%':
                    return '#6baed6';
                case '2.00-2.99%':
                    return '#4292c6';
                case '3.00-3.99%':
                    return '#2171b5';
                case '>4.00%':
                    return '#084594';
                case 'non-residential':
                    return '#f7fbff';
                default:
                    return '#c6dbef';
            }
        });

    // legend value text
    legend.append('text')
        .attr('x', x + 15)
        .attr('y', (d) => {
            if (d === 'non-residential') {
                return 59;
            }
            return 51;
        })
        .attr('dy', '0.32em')
        .attr('class', 'legend-value-text')
        .attr('text-anchor', 'end')
        .attr('xml:space', 'preserve')
        .text((d) => {
            if (d === 'non-residential') {
                return '  ' + d;
            }
            return ('-  ' + d);
        });
}

/**
 * Get the assigned color corresponding to a community based on the percent of
 * those who cycle to work
 * 
 * @param {string} commCode - A community code to get the color for
 * @param {Object} communities - Object containing community data
 */
function getAssignedColor(commCode, communities) {
    let percentCycling =
        communities[commCode].bicycle / bicyclistTotal * 100;

    if (percentCycling < 0.5) {
        return '#c6dbef';
    } else if (0.5 <= percentCycling && percentCycling < 1.0) {
        return '#9ecae1';
    } else if (1.0 <= percentCycling && percentCycling < 2.0) {
        return '#6baed6';
    } else if (2.0 <= percentCycling && percentCycling < 3.0) {
        return '#4292c6';
    } else if (3.0 <= percentCycling && percentCycling < 4.0) {
        return '#2171b5';
    } else if (4.0 <= percentCycling) {
        return '#084594';
    }
    return '#c6dbef';
}

/**
 * Process the row (community) from a CSV file and sum up and store the bicyclist 
 * total of the community
 * 
 * @param {Object} d
 * @param {number} i 
 * @param {Object} columns 
 */
function processCsvRow(d, i, columns) {
    // Convert all quantative values to numbers
    d.bicycle = +d.bicycle.replace(/,/g, '');
    d.drovealone = +d.drovealone.replace(/,/g, '');
    d.nowork = +d.nowork.replace(/,/g, '');
    d.motorcycle = +d.motorcycle.replace(/,/g, '');
    d.work_home = +d.work_home.replace(/,/g, '');
    d.transit = +d.transit.replace(/,/g, '');
    d.carpool_dr = +d.carpool_dr.replace(/,/g, '');
    d.carpool_pa = +d.carpool_pa.replace(/,/g, '');
    d.walk = +d.walk.replace(/,/g, '');

    // sum up the totals of people in this community surveyed
    let s = 0;
    for (i = 0; i < columns.length; i++) {
        if (cols.includes(columns[i])) {
            s += d[columns[i]];
        }
    };
    bicyclistTotal += d.bicycle;
    d.sum = s;
    return d;
}

/**
 * Reset the zoom/pan
 */
function resetZoom() {
    mapSVG.call(zoom.transform, d3.zoomIdentity.scale(1));
}