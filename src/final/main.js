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
const plotDimensions = { width: 1120, height: 420 };
const legendDimensions = { width: 180, height: 220 };

/**
 * Data column constants
 */
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

/**
 * Color constants
 */
const highlightColors = {
    'bicycle': '#f58231',
    'drovealone': '#e6194B',
    'nowork': '#ffe119',
    'transit': '#000075',
    'walk': '#bfef45',
    'work_home': '#3cb44b'
};

const colors = {
    'bicycle': [
        '#c6dbef', 
        '#9ecae1', 
        '#6baed6', 
        '#4292c6', 
        '#2171b5', 
        '#084594'
    ],
    'drovealone': [
        '#99d8c9',
        '#66c2a4',
        '#41ae76',
        '#238b45',
        '#006d2c',
        '#00441b'
    ],
    'nowork': [
        '#bcbddc',
        '#9e9ac8',
        '#807dba',
        '#6a51a3',
        '#54278f',
        '#3f007d'
    ],
    'transit': [
        '#fdae6b',
        '#fd8d3c',
        '#f16913',
        '#d94801',
        '#a63603',
        '#7f2704',
    ],
    'walk': [
        '#fa9fb5',
        '#f768a1',
        '#dd3497',
        '#ae017e',
        '#7a0177',
        '#49006a'
    ],
    'work_home': [
        '#fc9272',
        '#fb6a4a',
        '#ef3b2c',
        '#cb181d',
        '#a50f15',
        '#67000d',
    ]
};

/**
 * Scope variables
 */
let geoJsonData;
let modeOfTravel = 'bicycle';
let modeOfTravelTotals = {};
let selected = [];
let zoom;
let communities = {};
let mapSVG;
let plotSVG;
let legendSVG;

/**
 * Event listeners
 */
let dropdown = document.getElementsByClassName('dropdown')[0];
dropdown.addEventListener('click', (event) => {
    event.stopPropagation();
    dropdown.classList.toggle('is-active');
});

let dropdownItems = document.getElementsByClassName('dropdown-item');
let dropdownSelected = document.getElementById('dropdown-selected');
let activeItem = dropdownItems[0];
for (let i of dropdownItems) {
    i.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!i.classList.contains('is-active')) {
            i.classList.add('is-active');
            dropdownSelected.textContent = i.textContent.trim();
            activeItem.classList.remove('is-active');
            activeItem = i;

            // Close the dropdown
            dropdown.classList.remove('is-active');

            // Re-draw SVG components with new mode of travel
            document.getElementById("map-svg").remove();
            document.getElementById("plot-svg").remove();
            document.getElementById("legend-svg").remove();
            modeOfTravel = getColumnName(i.textContent.trim());
            draw();
        }
    });
}

/**
 * Load and parse data
 */
d3.json('../../data/geoJson/Community_Boundaries.geojson', (jsonData) => {
    d3.csv('../../data/Modes_of_Travel.csv', (d, i, columns) => {
        return processCsvRow(d, i, columns);
    }, (error, csvData) => {
        if (error) throw error;

        geoJsonData = jsonData;

        const travelModes = csvData.columns.filter((c) => {
            return cols.includes(c);
        });
        travelModes.push('unavailable');

        // Create a dictionary mapping comm_code to csvData for faster lookup
        csvData.forEach(community => {
            communities[community.comm_code] = community;
        });

        // Draw the SVG components
        draw();
    });
});

/**
 * Draw all the SVG components
 */
function draw() {
    // Create map
    createMap(geoJsonData);

    // Create legend
    createLegend();
        
    // Create plot
    createPlot();
}

/**
 * Creates the map
 */
function createMap() {
    mapSVG = d3.select('#map')
        .append('svg')
        .attr('id', 'map-svg')
        .attr('width', mapDimensions.width + mapMargin.left + mapMargin.right)
        .attr('height', mapDimensions.height + mapMargin.top + mapMargin.bottom)
        .append('g')
        .attr('transform', 'translate(' + mapMargin.left + ',' + mapMargin.top + ')');

    // Add a <g> element for each of the communities in the data
    let group = mapSVG
    .selectAll('g')
    .data(geoJsonData.features)
    .enter()
    .append('g')
    .attr('class', 'community')
    .attr('fill', (d) => {
        return getAssignedColor(d.properties.comm_code);
    });

    // Set the d3 geo projection and path
    const projection = d3.geoMercator()
        .fitExtent([
            [70, 10], 
            [mapDimensions.width-120, mapDimensions.height-10]
        ], geoJsonData);
    const path = d3.geoPath().projection(projection);

    // Append path to all the <g> elements
    let areas = group.append('path')
        .attr('d', path)
        .attr('class', 'area')
        .attr('id', d => { 
            return 'MAPID' + d.properties.comm_code; 
        });

    // Zoom and pan map
    zoom = d3.zoom().scaleExtent([1, 8]).on('zoom', () => {
        group.attr('transform', d3.event.transform)
    })
    mapSVG.call(zoom);

    // Add tooltip to the each community path element
    let tooltip = createTooltip('map');
    areas.on('mouseover', function(d) { 
            tooltip.style('display', null);

            // Highlight bar and map
            select(d.properties.comm_code);
        })
        .on('mouseout', function(d) { 
            tooltip.style('display', 'none');

            if (!selected.includes(d.properties.comm_code)) {
                // De-highlight bar and map
                deselect(d.properties.comm_code);
            }
        })
        .on('mousemove', function (d) {
            onMouseMove(tooltip, d.properties.comm_code, this, d);
        })
        .on('click', (d) => {
            if (!selected.includes(d.properties.comm_code)) {
                // Highlight on map and bar
                select(d.properties.comm_code);
                selected.push(d.properties.comm_code);
            } else {
                // De-highlight on map and bar
                deselect(d.properties.comm_code);
                selected.splice(selected.indexOf(d.properties.comm_code), 1);
            }
        });

    // Label for each community
    group.append('text')
        .attr('x', (d) => { return path.centroid(d)[0] })
        .attr('y', (d) => { return path.centroid(d)[1] })
        .attr('text-anchor', 'middle')
        .attr('class', 'text-label')
        .attr('font-weight', 'bold')
        .text(d => { return d.properties.comm_code })
        .on('mouseover', function(d) { 
            tooltip.style('display', null);

            // Highlight bar and map
            select(d.properties.comm_code);
        })
        .on('mouseout', function(d) { 
            tooltip.style('display', 'none');

            if (!selected.includes(d.properties.comm_code)) {
                // De-highlight bar and map
                deselect(d.properties.comm_code);
            }
        })
        .on('mousemove', function (d) {
            onMouseMove(tooltip, d.properties.comm_code, this, d);
        })
        .on('click', (d) => {
            if (!selected.includes(d.properties.comm_code)) {
                // Highlight on map and bar
                select(d.properties.comm_code);
                selected.push(d.properties.comm_code);
            } else {
                // De-highlight on map and bar
                deselect(d.properties.comm_code);
                selected.splice(selected.indexOf(d.properties.comm_code), 1);
            }
        });
}

/**
 * Creates the bar chart plot
 */
function createPlot() {
    plotSVG = d3.select('#graphPlot')
        .append('svg')
        .attr('id', 'plot-svg')
        .attr('width', plotDimensions.width + plotMargin.left + plotMargin.right)
        .attr('height', plotDimensions.height + plotMargin.top + plotMargin.bottom)
        .append('g')
        .attr('class', 'graphPlot')
        .attr('transform', 'translate(' + plotMargin.left + ',' + plotMargin.top + ')');

    // setup
    const MULTIPLIER = 4.75;
    let keys = Object.keys(communities).filter(k => { 
        // Filter out communities with 0 values for that mode of travel
        return communities[k][modeOfTravel] > 0 
    });

    let data = [];
    let minY = 0, maxY = 0;
    keys.forEach((k) => {
        data.push({
            ['comm_code']: k,
            [modeOfTravel]: communities[k][modeOfTravel],
            ['index']: keys.indexOf(k)
        });
        temp = communities[k][modeOfTravel];
        if (minY >= temp) minY = temp;
        if (maxY <= temp) maxY = temp;
    });

    // setup x
    let xScale = d3.scaleBand().range([0, (keys.length - 1) * MULTIPLIER]), // value -> display
        xAxis = d3.axisBottom().scale(xScale).tickSize(0);
    // setup y
    let yValue = (d) => { return d[modeOfTravel] }, // data -> value
        yScale = 
            d3.scaleLinear().range([plotDimensions.height, 0]), // value -> display
        yAxis = d3.axisLeft().scale(yScale);

    xScale.domain(keys);
    yScale.domain([minY, Math.ceil(maxY / 50) * 50]);   // Round maxY up to nearest 50
    let graphPlot = plotSVG;

    // x-axis
    graphPlot.append("g")
        .attr("class", "x-axis")
        .attr("transform", "translate(46," + (plotDimensions.height) + ")")
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
                .attr("stroke", "#363636");
        });
    graphPlot.append("text")
        .attr("class", "label")
        .attr("x", (plotDimensions.width + plotMargin.left + plotMargin.right) / 2)
        .attr("y", plotDimensions.height + plotMargin.top + plotMargin.bottom - 5)
        .style("text-anchor", "end")
        .text("Communities");

    graphPlot.append("g")
        .attr("class", "y-axis")
        .attr("transform", "translate(50,0)")
        .call(yAxis);
    graphPlot.append("text")
        .attr("class", "label")
        .attr("transform", "translate(0,100) rotate(-90)")
        .attr("y", 0)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text("Amount of people that " + 
            getHumanReadableMessage() + 
            (modeOfTravel === 'nowork' ? '' : ' to work'));

    // draw bars
    graphPlot.selectAll(".bar")
        .data(data).enter().append("rect")
        .attr("class", "bar")
        .attr('id', (d) => { 
            return 'BARID' + d.comm_code;
        })
        .attr("x", (d) => { 
            return 50 + 2 + xScale(d.comm_code); 
        })
        .attr("y", (d) => { 
            return yScale(yValue(d)); 
        })
        .attr("width", 5)
        .attr("height", (d) => { 
            return (plotDimensions.height) - yScale(yValue(d)); 
        })
        .attr('fill', (d) => {
            return getAssignedColor(d.comm_code);
        });

        let tooltip2 = createTooltip('plots');
        graphPlot.selectAll('.bar')
            .on('mouseover', function(d) { 
                tooltip2.style('display', null);

                // Highlight on map and bar
                select(d.comm_code);
            })
            .on('mouseout', function(d) { 
                tooltip2.style('display', 'none');

                if (!selected.includes(d.comm_code)) {
                    // De-highlight on map and bar
                    deselect(d.comm_code);
                }
            })
            .on('mousemove', function (d) {
                onMouseMove(tooltip2, d.comm_code, this);
            })
            .on('click', (d) => {
                if (!selected.includes(d.comm_code)) {
                    // Highlight on map and bar
                    select(d.comm_code);
                    selected.push(d.comm_code);
                } else {
                    // De-highlight on map and bar
                    deselect(d.comm_code);
                    selected.splice(selected.indexOf(d.comm_code), 1);
                }
            });
}

/**
 * Creates the legend
 */
function createLegend() {
    legendSVG = d3.select('#legend')
        .append('svg')
        .attr('id', 'legend-svg')
        .attr('width', legendDimensions.width + legendMargin.left + legendMargin.right)
        .attr('height', legendDimensions.height + legendMargin.top + legendMargin.bottom)
        .append('g')
        .attr('transform', 'translate(' + legendMargin.left + ',' + legendMargin.top + ')');

    let legendContainer = legendSVG.append('g');
    const x = 0;

    // legend label
    legendContainer.append('text')
        .attr('x', x)
        .attr('y', 10)
        .attr('dy', '0.32em')
        .attr('class', 'legend-text')
        .text('PERCENTAGE OF PEOPLE');
    legendContainer.append('text')
        .attr('x', x)
        .attr('y', 24)
        .attr('dy', '0.32em')
        .attr('class', 'legend-text')
        .text(getLegendTitle1());
    legendContainer.append('text')
        .attr('x', x)
        .attr('y', 38)
        .attr('dy', '0.32em')
        .attr('class', 'legend-text')
        .text(getLegendTitle2());
    legendContainer.append('text')
        .attr('x', x)
        .attr('y', 52)
        .attr('dy', '0.32em')
        .attr('class', 'legend-text')
        .text(getLegendTitle3());

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
                    return colors[modeOfTravel][0];
                case '0.50-0.99%':
                    return colors[modeOfTravel][1];
                case '1.00-1.99%':
                    return colors[modeOfTravel][2];
                case '2.00-2.99%':
                    return colors[modeOfTravel][3];
                case '3.00-3.99%':
                    return colors[modeOfTravel][4];
                case '>4.00%':
                    return colors[modeOfTravel][5];
                case 'non-residential':
                    return '#f7fbff';
                default:
                    return colors[modeOfTravel][0];
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
 * Handle mouse move events on the map and bars
 * 
 * @param {Object} tooltip - The tooltip object to show
 * @param {string} commCode - The community code
 * @param {Object} scope - The "this" object of the calling code
 * @param {Object} d - Optional. Only when we need it to retrieve the name
 */
function onMouseMove(tooltip, commCode, scope, d = null) {
    let dataIsAvailable = !!communities[commCode];
    let tooltipHeight = 20;
    let tooltipWidth = 0;
    let xPosition = d3.mouse(scope)[0] + 10;
    let yPosition = d3.mouse(scope)[1] + 20;
    let commName = d === null ? communities[commCode].name : d.properties.name;
    tooltip.attr(
        'transform', 'translate(' + xPosition + ',' + yPosition + ')');
    tooltip.select('text').text(commName);
    tooltipWidth = getTooltipWidth(commName, tooltipWidth);

    if (dataIsAvailable) {
        tooltipHeight = 60;

        tooltip.select('text')
            .append('svg:tspan')
            .attr('x', 0)
            .attr('dy', 20)
            .text(communities[commCode][modeOfTravel] +
                ' people who live here')
            .attr('x', 10);
        tooltipWidth =
            getTooltipWidth(communities[commCode][modeOfTravel] +
                ' people who live here', tooltipWidth);

        tooltip.select('text')
            .append('svg:tspan')
            .attr('x', 0)
            .attr('dy', 20)
            .text(getHumanReadableMessage() + 
                (modeOfTravel === 'nowork' ? '' : ' to work'))
            .attr('x', 10);
        tooltipWidth =
            getTooltipWidth(getHumanReadableMessage() + 
                (modeOfTravel === 'nowork' ? '' : ' to work'), tooltipWidth);
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
}

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
        .attr('rx', '5')
        .attr('ry', '5')
        .attr('fill', '#363636')
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
 * Get the assigned color corresponding to a community based on the percent of
 * those who cycle to work
 * 
 * @param {string} commCode - A community code to get the color for
 */
function getAssignedColor(commCode) {
    if (!(!!communities[commCode])) {
        // 'Disabled' color for communities we don't have data for
        return '#f7fbff';
    }

    let percentCycling =
        communities[commCode][modeOfTravel] / modeOfTravelTotals[modeOfTravel] * 100;

    if (percentCycling < 0.5) {
        return colors[modeOfTravel][0];
    } else if (0.5 <= percentCycling && percentCycling < 1.0) {
        return colors[modeOfTravel][1];
    } else if (1.0 <= percentCycling && percentCycling < 2.0) {
        return colors[modeOfTravel][2];
    } else if (2.0 <= percentCycling && percentCycling < 3.0) {
        return colors[modeOfTravel][3];
    } else if (3.0 <= percentCycling && percentCycling < 4.0) {
        return colors[modeOfTravel][4];
    } else if (4.0 <= percentCycling) {
        return colors[modeOfTravel][5];
    }
    return colors[modeOfTravel][0];
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

            // Sum up the total for each mode of travel
            if (!modeOfTravelTotals[columns[i]]) {
                modeOfTravelTotals[columns[i]] = 0;
            }
            modeOfTravelTotals[columns[i]] += d[columns[i]];
        }
    };
    d.sum = s;
    return d;
}

/**
 * Reset the zoom/pan and selected
 */
function reset() {
    mapSVG.call(zoom.transform, d3.zoomIdentity.scale(1));
    selected.forEach(s => { 
        deselect(s);
    });
    selected = [];
}

/**
 * Hightlight the community on the bar and map
 * 
 * @param {string} commCode The community code
 */
function select(commCode) {
    d3.select('#MAPID' + commCode).attr('fill', highlightColors[modeOfTravel]);
    d3.select('#BARID' + commCode).attr('fill', highlightColors[modeOfTravel]);
}

/**
 * De-highlight the community on the map and bar
 * 
 * @param {string} commCode - The community code
 */
function deselect(commCode) {
    // De-highlight on map
    d3.select('#MAPID' + commCode)
        .attr('fill', getAssignedColor(commCode));
    d3.select('#BARID' + commCode)
        .attr('fill', getAssignedColor(commCode));
}

/**
 * Legend title line 1
 */
function getLegendTitle1() {
    switch (modeOfTravel) {
        case 'bicycle':
            return 'CYCLING TO WORK';
        case 'drovealone':
            return 'DRIVING ALONE TO WORK';
        case 'transit':
            return 'TAKING TRANSIT TO WORK';
        case 'walk':
            return 'WALKING TO WORK';
        case 'work_home':
            return 'WORKING FROM HOME';
        case 'nowork':
            return 'THAT ARE UNEMPLOYED';
    }
}

/**
 * Legend title line 2
 */
function getLegendTitle2() {
    switch (modeOfTravel) {
        case 'bicycle':
            return '(OF TOTAL THAT CYCLE';
        case 'drovealone':
            return '(OF TOTAL THAT DRIVE ALONE';
        case 'transit':
            return '(OF TOTAL THAT TRANSIT';
        case 'walk':
            return '(OF TOTAL THAT WALK';
        case 'work_home':
            return '(OF TOTAL THAT WORK FROM';
        case 'nowork':
            return '(OF TOTAL UNEMPLOYED';
    }
}

/**
 * Legend title line 3
 */
function getLegendTitle3() {
    switch (modeOfTravel) {
        case 'bicycle':
            return 'TO WORK IN CALGARY)';
        case 'drovealone':
            return 'TO WORK IN CALGARY)';
        case 'transit':
            return 'TO WORK IN CALGARY)';
        case 'walk':
            return 'TO WORK IN CALGARY)';
        case 'work_home':
            return 'HOME IN CALGARY)';
        case 'nowork':
            return 'IN CALGARY)';
    }
}

/**
 * Get the columnn name from the human-readable mode of travel name
 * 
 * @param {string} mode - The mode of travel
 */
function getColumnName(mode) {
    switch (mode) {
        case 'Bicycle':
            return 'bicycle';
        case 'Drive alone':
            return 'drovealone';
        case 'Transit':
            return 'transit';
        case 'Walk':
            return 'walk';
        case 'Work from home':
            return 'work_home';
        case 'Unemployed':
            return 'nowork';
    }
}

/**
 * Retrieve the human-readable message that we will use in the tooltip and axes
 */
function getHumanReadableMessage() {
    switch (modeOfTravel) {
        case 'bicycle':
            return 'bicycle';
        case 'drovealone':
            return 'drive alone';
        case 'transit':
            return 'transit';
        case 'walk':
            return 'walk';
        case 'work_home':
            return 'stay at home';
        case 'nowork':
            return 'are unemployed';
    }
}