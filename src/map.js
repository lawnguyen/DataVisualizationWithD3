
const width = 760, height = 700;

const colors = ["#FF595E", "#FFCA3A", "#8AC926", "#1982C4", "#6A4C93"];

let canvas = d3.select("body")
    .append("svg")
    .attr("width", width)
    .attr("height", height)

d3.json("../data/geoJson/Community_Boundaries.geojson", (data) => {
    // Add a <g> element for each of the communities in the data
    let group = canvas.selectAll("g")
        .data(data.features)
        .enter()
        .append("g")
        .attr("fill", () => {
            return colors[Math.floor((Math.random() * colors.length))]; 
        })

    // Set the d3 geo projection and path
    const projection = d3.geoMercator().fitSize([width, height], data);
    const path = d3.geoPath().projection(projection);

    // Append path to all the <g> elements
    let areas = group.append("path")
        .attr("d", path)
        .attr("class", "area")

    // Label for each community
    group.append("text")
        .attr("x", (d) => { return path.centroid(d)[0] })
        .attr("y", (d) => { return path.centroid(d)[1] })
        .attr("text-anchor", "middle")
        .attr("fill", "grey")
        .text(d => { return d.properties.comm_code })
});