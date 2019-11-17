
const width = 760, height = 700;

const colors = [
    '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
    '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
    '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000',
    '#aaffc3', '#808000', '#ffd8b1', '#808080'
];

// The columns from the dataset that we are interested in
const cols = [
    "drovealone",
    "nowork",
    "transit",
    "carpool_dr",
    "carpool_pa",
    "bicycle",
    "motorcycle",
    "walk",
    "work_home"
];

let canvas = d3.select('#chart')
    .append('svg')
       .attr('width', width)
       .attr('height', height)
       .attr("align","center");

d3.json('../data/geoJson/Community_Boundaries.geojson', (jsonData) => {
    d3.csv("../data/Modes_of_Travel.csv", (d, i, columns) => {
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
        //   .attr('fill', () => {
        //       return colors[Math.floor((Math.random() * colors.length))];
        //   })
          .attr('fill', (d) => { 
                const communityCode = d.properties.comm_code;
                const comm = communities[communityCode];
                if (!comm) {
                    return '#EBEBE4';
                }

                let max = null; 
                for (c in comm) {
                    if (cols.includes(c)) { 
                        if (max === null) { max = c; } 
                        if (comm[c] > comm[max]) { 
                            max = c;
                        } 
                    } 
                };
                console.log("the max is: " + max + " for " + comm.name);

                return 'yellow';
            });

        // Set the d3 geo projection and path
        const projection = d3.geoMercator().fitSize([width, height], jsonData);
        const path = d3.geoPath().projection(projection);

        // Append path to all the <g> elements
        let areas = group.append('path')
            .attr('d', path)
            .attr('class', 'area');

        // Label for each community
        group.append('text')
            .attr('x', (d) => { return path.centroid(d)[0] })
            .attr('y', (d) => { return path.centroid(d)[1] })
            .attr('text-anchor', 'middle')
            .attr('class', 'text-label')
            .text(d => { return d.properties.comm_code });
    });
});

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

    d.sum = s;
    return d;
}