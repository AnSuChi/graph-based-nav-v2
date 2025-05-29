export function renderNodeElements(nodes){
    nodes.append("circle")
        .attr("r", 500)
        .attr("fill", "red")
        .attr("stroke", "black")
        .attr("stroke-width", 2);

    nodes.append("text")
        .text(node => node.title.length > 45 ? node.title.slice(0, 45) + "..." : node.title)
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("fill", "white")
        .attr("font-size", "40px")
        .attr("font-weight", "bold");
};
export function addDragBehaviour(nodes){
    nodes.call(d3.drag()
            .on("start", (event, node) => dragStart(event, node, globalSimulation))
            .on("drag", (event, node) => dragged(event, node))
            .on("end", (event, node) => dragEnd(event, node, globalSimulation))
    );
};

function dragStart(event, node, simulation) {
    if (!event.active) simulation.alphaTarget(1).restart();
    node.fx = node.x;
    node.fy = node.y;
};
function dragged(event, node) {
    node.fx = event.x;
    node.fy = event.y;
};
function dragEnd(event, node, simulation) {
    if (!event.active) simulation.alphaTarget(0);
    node.fx = null;
    node.fy = null;
};


// returns an array containing currently selected node and its data: [selectedNode, data]
export function getSelectedNode() {
    let selectedNode = d3.select("g[data-selected='true']");
    if (!selectedNode) return;

    return selectedNode;
};
// removes data-selected attribute on the "node" html-element
export function unselectNode(node) {
    node.attr("data-selected", null);
};
// adds data-selected attribute, using the html-element
export function setSelectedNode(node) {
    d3.select(node.element).attr("data-selected", "true");
};

export function setSimulation(nodes, edges, width, height){
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(edges)
            .id(node => node.id)
            .distance(5000)
        )
        .force("charge", d3.forceManyBody()) 
        .force("collide", d3.forceCollide(2500))
        .force("center", d3.forceCenter(width / 2, height / 2));
    

    return simulation;
};