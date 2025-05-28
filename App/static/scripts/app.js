// Cache reset chrome --> cmd+shift+R

// IMPORTS
import { 
    selectRandomNode, 
    navigateSimilarNodes, 
    selectNode, 
} from "./navigation.js"; 
import { 
    resetSidebar,
    resetTranscript,
    displayTraversalController
} from "./ui.js"; 



// GLOBAL VARIABLES
let showCloseCategoriesBtn = false;

export let connectedNodesLimit = 5;
export let globalSimulation;
export let zoomBehaviour;
export const colorScale = d3.scaleOrdinal()
  .range(d3.range(280).map(i => {
    const hue = ((i + 10) * 360 / 230) % 360;
    const saturation = 0.6 + 0.4 * Math.sin(i * 0.15);  // varies between 0.2 and 1
    const lightness = 0.45 + 0.1 * Math.cos(i * 0.1);   // varies between 0.35 and 0.55

    return d3.hsl(hue, saturation, lightness).toString();
}));




// HANDLE JSON DATA
async function fetchJsonData(source) {
    try {
        const response = await fetch(source);
        return await response.json();
    }
    catch(error) {
        console.error("Could not fetch JSON data");
        return null;
    }  
};
export async function getJsonData(jsonDataType) {
    // jsonDataType must be either "nodes" or "edges"
    const data = await fetchJsonData(`/data/${jsonDataType}.json`);
    if (!data) return null;
    return data;
};
export async function getTranscriptData(identifier) {
    const transcriptData = await fetchJsonData(`/data/transcripts/${identifier}.json`);
    if (!transcriptData) return null;
    return transcriptData;
};




// TRACK SELECTED NODE
export const trackSelectedNodes = (() => {
    let prevNodesList = [];
    let prevElementsList = [];
    let indexHistory = 1;
    let minListSize = 1;

    return {
        addNode: (nodeData, addToListIsTrue) => {
            if (addToListIsTrue) {
                prevNodesList.push(nodeData);
                indexHistory = 1;
            };
        },
        addNodeElement: (nodeElement, addToListIsTrue) => {
            if (addToListIsTrue) {
                prevElementsList.push(nodeElement);
            };
        },
        getPrevNode: () => {
            if (prevNodesList.length >= minListSize && indexHistory <= prevNodesList.length) {
                if (indexHistory < prevNodesList.length) {
                    indexHistory++;
                };
                let node = prevNodesList[prevNodesList.length - indexHistory];
                return node;
            }
            return null;
        },
        getPrevNodeElement: () => {
            if (prevElementsList.length >= minListSize && indexHistory <= prevNodesList.length) {
                let nodeElement = prevElementsList[prevElementsList.length - indexHistory];
                return nodeElement;
            }
            return null;
        },
        getAllNodes: () => prevNodesList,
        getAllElements: () => prevElementsList,
        reset: () => {
            prevNodesList = [];
            prevElementsList = [];
            indexHistory = 1;
            minListSize = 1;
        },
        loadNodes: (nodes) => {
            prevNodesList = nodes;
        },
        loadElements: (elements) => {
            prevElementsList = elements;
        }        
    };
})();




// GRAPH
async function initializeGraph(nodesData) {
    const edgePerNode = 2;

    const edgesData = await getJsonData("edges");
    const nodeIds = new Set(nodesData.nodes.map(node => node.id));
    const nodeEdgeCounts = new Map();
    const registeredEdgeKeys = new Set();
    
    const limitedEdges = edgesData.edges.filter(edge => {
        if (!(nodeIds.has(edge.source) && nodeIds.has(edge.target))) return false;
    
        const key = [edge.source, edge.target].sort().join("-");
        if (registeredEdgeKeys.has(key)) return false;
    
        const sourceCount = nodeEdgeCounts.get(edge.source) || 0;
        const targetCount = nodeEdgeCounts.get(edge.target) || 0;    
        if (sourceCount >= edgePerNode || targetCount >= edgePerNode) return false;
    
        registeredEdgeKeys.add(key);
        nodeEdgeCounts.set(edge.source, sourceCount + 1);
        nodeEdgeCounts.set(edge.target, targetCount + 1);
    
        return true;
    });
    
    const graphContainer = document.getElementById("graph-nav-domain");
    let width = Math.floor(graphContainer.clientWidth);
    let height = Math.floor(graphContainer.clientHeight);

    const svg = d3.select("#graphSvg")
        .html("") // removes previous graph components
        .attr("width", width)
        .attr("height", height)
        .style("display", "block");

    // to capture zoom events
    svg.append("rect") 
        .attr("width", width)
        .attr("height", height)
        .style("fill", "none")
        .style("pointer-events", "all");

    const zoomContainer = svg.append("g");

    const edgeLayer = zoomContainer.append("g").attr("class", "edges");
    const nodeLayer = zoomContainer.append("g").attr("class", "nodes");

    zoomBehaviour = d3.zoom()
        .scaleExtent([0.01, 1])
        .on("zoom", (event) => {
            zoomContainer.attr("transform", event.transform);
        });

    const scaleValue = 0.01;
    const x = (width / 2) - (scaleValue);
    const y = (height / 2) - (scaleValue);
    const initialTransform = d3.zoomIdentity.translate(x, y).scale(scaleValue);

    svg.call(zoomBehaviour);
    svg.transition().duration(500).call(zoomBehaviour.transform, initialTransform);

    const simulation = d3.forceSimulation(nodesData.nodes)
        .force("link", d3.forceLink(limitedEdges)
            .id(node => node.id)
            .distance(5000)
        )
        .force("charge", d3.forceManyBody()) 
        .force("collide", d3.forceCollide(2500))
        .force("center", d3.forceCenter(width / 2, height / 2));
    

    globalSimulation = simulation;

    const edges = edgeLayer.selectAll("line")
        .data(limitedEdges)
        .enter()
        .append("line")
        .attr("stroke", "black")
        .attr("stroke-width", edge => edge.weight * ((edge.weight*100) - 10));

    const nodes = nodeLayer.selectAll("g")
        .data(nodesData.nodes)
        .enter()
        .append("g")

    renderNodeElements(nodes);
    addDragBehaviour(nodes);

    simulation.on("tick", () => {
        edges
            .attr("x1", edge => edge.source.x)
            .attr("y1", edge => edge.source.y)
            .attr("x2", edge => edge.target.x)
            .attr("y2", edge => edge.target.y);

        nodes.attr("transform", node => `translate(${node.x},${node.y})`);    
    });

    nodes.on("click", (event, node) => {
        selectNode(event, node, true);
    });    

    toggleCategories(false);
};
export async function addRelatedNodes(selectedNode, simulation, edgesData, nodesData) {
    const connectedNodeIds = new Set();
    const registeredEdgeKeys = new Set();
    const existingNodeIds = new Set();
    
    const allEdges = edgesData.edges;
    const relatedEdges = allEdges.filter(edge =>
        edge.source === selectedNode.id || edge.target === selectedNode.id
    ).slice(0, connectedNodesLimit);

    relatedEdges.forEach(edge => {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
    });
    connectedNodeIds.delete(selectedNode.id);

    const relatedNodes = nodesData.nodes.filter(node => connectedNodeIds.has(node.id));

    const nodeLayer = d3.select(".nodes");
    const edgeLayer = d3.select(".edges");

    nodeLayer.selectAll("g").each(function(node) {
        if (node) existingNodeIds.add(node.id);
    });
    edgeLayer.selectAll("line").each(function(edge) {
        if (edge) registeredEdgeKeys.add(`${edge.source.id}-${edge.target.id}`);
    });

    const newEdges = relatedEdges.filter(edge => {
        const key = `${edge.source}-${edge.target}`;
        const reverseKey = `${edge.target}-${edge.source}`;

        return !registeredEdgeKeys.has(key) && !registeredEdgeKeys.has(reverseKey);
    });

    const newNodesData = relatedNodes.filter(node => !existingNodeIds.has(node.id));

    const centerX = selectedNode.x;
    const centerY = selectedNode.y;
    const spread = 10;

    newNodesData.forEach(node => {
        node.x = centerX + (Math.random() - 0.5) * spread;
        node.y = centerY + (Math.random() - 0.5) * spread;
        node.vx = 0;
        node.vy = 0;
    });

    selectedNode.fx = selectedNode.x;
    selectedNode.fy = selectedNode.y;

    edgeLayer.selectAll("line")
        .data(newEdges, d => `${d.source}-${d.target}`)
        .enter()
        .append("line")
        .attr("stroke", "black")
        .attr("stroke-width", edge => edge.weight * ((edge.weight*100) - 10))
        .style("opacity", 0)
        .transition()
        .duration(1000)
        .style("opacity", 1);

    const newNodes = nodeLayer.selectAll("g")
        .data(newNodesData, d => d.id)
        .enter()
        .append("g")
        .style("opacity", 0)
        .on("click", (event, d) => selectNode(event, d, true))

    renderNodeElements(newNodes);
    addDragBehaviour(newNodes);

    newNodes.transition()
        .duration(1000)
        .style("opacity", 1);

    const updatedNodes = [...simulation.nodes(), ...newNodesData];
    const updatedEdges = [...simulation.force("link").links(), ...newEdges];

    simulation.nodes(updatedNodes);
    simulation.force("link").links(updatedEdges);

    simulation.on("tick", () => {
        edgeLayer.selectAll("line")
            .attr("x1", edge => edge.source.x)
            .attr("y1", edge => edge.source.y)
            .attr("x2", edge => edge.target.x)
            .attr("y2", edge => edge.target.y);

        nodeLayer.selectAll("g")
            .attr("transform", node => `translate(${node.x},${node.y})`);
    });

    simulation.alpha(0.05).restart();

    setTimeout(() => {
        simulation.alpha(0.25).restart();
        selectedNode.fx = null;
        selectedNode.fy = null;
    }, 800); // match transition duration
};

function renderNodeElements(nodes){
    nodes.append("circle")
        .attr("r", 500)
        .attr("fill", node => colorScale(node.topic))
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
function addDragBehaviour(nodes){
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




// CATEGORIES
export function toggleCategories(showCategories){
    if (showCloseCategoriesBtn === false) {
        showCloseCategoriesBtn = true;
    } else {
        const closeCategoriesBtn = document.getElementById("close-categories-btn");
        closeCategoriesBtn.style.display = "block";  
    };

    let categoriesContainer = document.getElementById("category-selection-container");
    let showCategoriesBtn = document.getElementById("show-categories-btn-container");
    
    switch (showCategories) {
        case false:
            categoriesContainer.style.display = "none";
            showCategoriesBtn.style.display = "block";
            break;
        case true:
            categoriesContainer.style.display = "block";
            showCategoriesBtn.style.display = "none";
            break;
        default:
            break;
    };
};
async function loadCategories(){
    const categoriesUl = document.getElementById("category-selection");
    let categoriesJson = await fetchJsonData("/data/categories.json");

    Object.keys(categoriesJson).sort().forEach((category, index) => {
        let li = document.createElement("li");

        let categorySelectBtn = document.createElement("button");
        categorySelectBtn.id = `category-${index}-btn`;
        categorySelectBtn.textContent = category;
        categorySelectBtn.onclick = () => getTalksFromCategory(categoriesJson[category], category, categorySelectBtn.id); 

        li.appendChild(categorySelectBtn);
        categoriesUl.appendChild(li);
    });
};

async function getTalksFromCategory(categoryData, selectedCategory, categoryBtnId) {
    const allNodes = await getJsonData("nodes");
    const categoryMsg = document.getElementById("category-msg");

    const categoryBtns = document.querySelectorAll("#category-selection button");
    categoryBtns.forEach(btn => btn.classList.remove("categorySelectedBtn"));
    const categoryBtn = document.getElementById(categoryBtnId.toString());
    categoryBtn.classList.add("categorySelectedBtn");

    const identifiersSet = new Set(
        categoryData.map(filename => filename.replace(".stm", ""))
    );
    const relevantNodes = allNodes.nodes.filter(node =>
        identifiersSet.has(node.identifier)
    );

    categoryMsg.innerText = `Selected category - ${selectedCategory}`;

    initializeGraph({ nodes: relevantNodes });
    trackSelectedNodes.reset();
    resetTranscript("ordinary")
    resetSidebar();
    displayTraversalController();
};




// EVENT LISTENERS
document.addEventListener("DOMContentLoaded", async () => {
    const closeCategoriesBtn = document.getElementById("close-categories-btn");
    toggleCategories(true);
    closeCategoriesBtn.style.display = "none";
    
    loadCategories();
    resetTranscript("modal");
    resetTranscript("ordinary");
});

document.getElementById("selectRandNode-btn").addEventListener("click", () => {
    selectRandomNode();
});

document.getElementById("next-node-btn").addEventListener("click", async () => {
    let selectedNodeElement = getSelectedNode();
    if (!selectedNodeElement) return;
    let nodeData = selectedNodeElement.datum(); 

    const allEdgeElements = d3.selectAll(".edges line");
    const allNodeElements = d3.selectAll(".nodes g");

    const connectedEdgesList = [];

    allEdgeElements.each(function(edgeData) {
        if (!edgeData) return;

        const { source, target, weight } = edgeData;
        const sourceId = source.id || source;
        const targetId = target.id || target;

        if (sourceId === nodeData.id || targetId === nodeData.id) {
            connectedEdgesList.push({ source: sourceId, target: targetId, weight });
        }
    });

    if (connectedEdgesList.length === 0) return;

    // edge-node pairs, sorted by weight
    const allNodeData = Array.from(allNodeElements)
        .map(el => d3.select(el).datum());

    const sortedNodeEdgePairs = connectedEdgesList
        .map(edge => {
            const otherNodeId = edge.source === nodeData.id ? edge.target : edge.source;
            const matchedNode = allNodeData.find(n => n.id === otherNodeId);
            return matchedNode ? { edge, node: matchedNode } : null;
        })
        .filter(pair => pair !== null)
        .sort((a, b) => b.edge.weight - a.edge.weight); // descending similarity/weight

    const sortedEdges = sortedNodeEdgePairs.map(pair => pair.edge);
    const sortedNodes = sortedNodeEdgePairs.map(pair => pair.node);

    navigateSimilarNodes(sortedEdges, sortedNodes);
});

document.getElementById("prev-node-btn").addEventListener("click", () => {
    let selectedNodeElement = getSelectedNode();
    let prevNode = trackSelectedNodes.getPrevNode();
    let prevNodeElement = trackSelectedNodes.getPrevNodeElement();

    if (!prevNode || ! prevNodeElement) return;
    if (selectedNodeElement.datum().id == prevNode.id) {
        return;
    };

    setSelectedNode(prevNodeElement);
    selectNode({ currentTarget: prevNodeElement }, prevNode, false);
});

document.getElementById("close-categories-btn").addEventListener("click", () => {
    toggleCategories(false);
});
document.getElementById("show-categories-btn").addEventListener("click", () => {
    toggleCategories(true);
});