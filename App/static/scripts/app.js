// Cache reset chrome --> cmd+shift+R

// IMPORTS
import { 
    renderNodeElements,
    addDragBehaviour,
    getSelectedNode,
    unselectNode,
    setSelectedNode,
    setSimulation
} from "./graph.js"; 
import { 
    
} from "./navigation.js"; 
import { 
    resetTranscript,
    displayTraversalController,
    updateCategoryUI,
    toggleCategories,
    setSimilaritySpanValue,
    resetEdgeColors,
    updateNodeSidebar,
    toggleTranscript,
    resetSidebar,
    showSidebar,
    closeModal,
    setTalkDetails,
    resetNodes,
    updateSelectedNodeStyle
} from "./ui.js"; 


// GLOBAL VARIABLES
const edgePerNode = 2;
let connectedNodesLimit = 5;
let topTalksCount = 3; // warning: remember setting it less than or equal to "connectedNodesLimit" variable!

let currentNodeIndex = 0;
let sameNodeSelected = null;

let globalSimulation;
let zoomBehaviour;


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

    resetEdgeColors();
    let nextEdge = navigateSimilarNodesGetEdge(sortedEdges, sortedNodes);
    setSimilaritySpanValue(nextEdge.weight);
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
    resetUI();
});

document.getElementById("close-categories-btn").addEventListener("click", () => {
    toggleCategories(false);
});
document.getElementById("show-categories-btn").addEventListener("click", () => {
    toggleCategories(true);
});

document.getElementById("close-modal-btn").addEventListener("click", () => {
    closeModal();
});


// function for graph traversal
export function confirmSelectNode(nextNode) {
    let selectedNodeElement = getSelectedNode();
    if (!selectedNodeElement) return;

    // get all nodes
    let nodes = d3.selectAll("g").nodes() 
        .map(node => ({
            element: node,
            data: d3.select(node).datum()
        }))
        .filter(node => node.data);
    if (nodes.length === 0) return;

    // find the node that matches nextNode data
    let matchingNode = nodes.find(node => node.data.id == nextNode.id);
    if (!matchingNode) return;

    unselectNode(selectedNodeElement);
    setSelectedNode(matchingNode.element);
    selectNode({ currentTarget: matchingNode.element }, matchingNode.data, true);
    resetUI();
};

export function navigateSimilarNodesGetEdge(edgesList, nodesList){
    let nextNode = nodesList[currentNodeIndex];
    let nextEdgeData = edgesList[currentNodeIndex];
    if (!nextNode || !nextEdgeData) return;

    // highlight the edge
    d3.select(".edges").selectAll("line")
        .style("stroke", "black") 
        .filter(d => 
            (d.source.id === nextEdgeData.source && d.target.id === nextEdgeData.target) || 
            (d.source.id === nextEdgeData.target && d.target.id === nextEdgeData.source)
        )
        .style("stroke", "red")
        .style("stroke-width", edge => edge.weight * ((edge.weight*300)))
        .each(function() {
            this.parentNode.appendChild(this); // bring edge to front
        });
  
    currentNodeIndex = (currentNodeIndex + 1) % edgesList.length;

    let confirmBtn = document.getElementById("confirm-node-btn");
    confirmBtn.replaceWith(confirmBtn.cloneNode(true)); // remove old listener
    confirmBtn = document.getElementById("confirm-node-btn");

    confirmBtn.addEventListener("click", () => {
        confirmSelectNode(nextNode);

        d3.selectAll("line")
            .filter(d => 
                (d.source.id === nextEdgeData.source && d.target.id === nextEdgeData.target) || 
                (d.source.id === nextEdgeData.target && d.target.id === nextEdgeData.source)
            )
            .style("stroke", "black");
    }, { once: true });

    return nextEdgeData;
};


export async function getConnectedNodesList(nodeData, listLimit) {
    const nodesData = await getJsonData("nodes");
    const edgesData = await getJsonData("edges");
    if (!nodesData) return { edgesList: [], nodesList: [] };

    let strongConnections = edgesData.edges
        .filter(edge => (edge.source == nodeData.id) || (edge.target == nodeData.id));

    let edgesList = strongConnections.slice(0, listLimit);

    let nodesList = edgesList.map(edge => 
        nodesData.nodes.find(node => node.id === (edge.source === nodeData.id ? edge.target : edge.source))
    );

    return { edgesList, nodesList };
};

async function getMostSimilarNodes(count){
    let selectedNodeElement = getSelectedNode();
    if (!selectedNodeElement) return;

    let nodeData = selectedNodeElement.datum();
    let { edgesList, nodesList } = await getConnectedNodesList(nodeData, count);
    if (edgesList === undefined || nodesList === undefined) return;

    let countSpan = document.getElementById("count-txt");
    const traversalContainerDiv = document.getElementById("traversal-container");
    if (nodesList.length <= 0) {
        countSpan.style.color = "#ff9752";
        traversalContainerDiv.style.display = "none";
        countSpan.textContent = `This talk doesn't share a meaningful similarity score with any other talks`;
    } else {
        countSpan.style.color = "#ffffff";
        traversalContainerDiv.style.display = "block";
        countSpan.textContent = `Top ${nodesList.length} similar talks`;  
    };

    let topTalksContainer = document.getElementById("top-similar-talks-container");
    topTalksContainer.innerHTML = "";

    for (let i = 0; i < nodesList.length; i++) {    
        const nextTalkDiv = document.createElement("div");
        nextTalkDiv.className = "next-talk";
        nextTalkDiv.id = `talk-${nodesList[i].id}`;
      
        const nodeTitleP = document.createElement("p");
        nodeTitleP.textContent = `" ${nodesList[i].title} "`;
        nodeTitleP.className = "next-talk-title";
      
        const nextTalkBtn = document.createElement("button");
        nextTalkBtn.textContent = "Go to talk";
        nextTalkBtn.id = `talk-${nodesList[i].id}-btn`;
        nextTalkBtn.className = "next-talk-btn";

        const talkDetailsBtn = document.createElement("button");
        talkDetailsBtn.textContent = "View details";
        talkDetailsBtn.id = `details-talk-${nodesList[i].id}-btn`;
        talkDetailsBtn.className = "next-talk-btn";

        nextTalkDiv.appendChild(nodeTitleP);
        nextTalkDiv.appendChild(nextTalkBtn);
        nextTalkDiv.appendChild(talkDetailsBtn);
      
        topTalksContainer.appendChild(nextTalkDiv);

        document.getElementById(`talk-${nodesList[i].id}-btn`).addEventListener("click", () => {
            confirmSelectNode(nodesList[i]);
        });
        document.getElementById(`details-talk-${nodesList[i].id}-btn`).addEventListener("click", () => {
            viewTalkDetails(nodesList[i], nodesList[i].id);
        });
    };      
};

export async function viewTalkDetails(node, talkId){
    const transcriptData = await getTranscriptData(`${node.identifier}`);

    setTalkDetails(node);
    setSimilarityModal(talkId);
    toggleTranscript("modal", transcriptData.transcript);
};




// ------------ FROM HERE ------------

// GLOBALS
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


// GRAPH
async function initializeGraph(nodesData, edgesData) {
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

    let simulation = setSimulation(nodesData.nodes, limitedEdges, width, height);
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
        resetUI();
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

    resetUI();

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


async function loadCategories(){
    const categoriesJson = await fetchJsonData("/data/categories.json");
    const allNodes = await getJsonData("nodes");

    const categoriesUl = document.getElementById("category-selection");

    Object.keys(categoriesJson).sort().forEach((category, index) => {
        let li = document.createElement("li");

        let categorySelectBtn = document.createElement("button");
        categorySelectBtn.id = `category-${index}-btn`;
        categorySelectBtn.textContent = category;
        categorySelectBtn.onclick = () => getTalksFromCategory(categoriesJson[category], category, categorySelectBtn.id, allNodes); 

        li.appendChild(categorySelectBtn);
        categoriesUl.appendChild(li);
    });
};
async function getTalksFromCategory(categoryData, selectedCategory, categoryBtnId, allNodes) {
    const edgesData = await getJsonData("edges");

    const identifiersSet = new Set(
        categoryData.map(filename => filename.replace(".stm", ""))
    );
    const relevantNodes = allNodes.nodes.filter(node =>
        identifiersSet.has(node.identifier)
    );

    updateCategoryUI(selectedCategory, categoryBtnId);
    initializeGraph({ nodes: relevantNodes }, edgesData);
    
    trackSelectedNodes.reset();

    resetTranscript("ordinary")
    resetSidebar();
    displayTraversalController();
};


// SELECT FUNCTIONS
export async function selectNode(event, nodeData, addToListIsTrue) {
    const transcriptData = await getTranscriptData(`${nodeData.identifier}`);

    currentNodeIndex = 0;

    if (sameNodeSelected === nodeData) return;
    sameNodeSelected = nodeData;

    trackSelectedNodes.addNode(nodeData, addToListIsTrue);
    trackSelectedNodes.addNodeElement(event.currentTarget, addToListIsTrue)

    resetNodes(nodeData);
    updateSelectedNodeStyle(nodeData, event.currentTarget);

    let graphContainer = document.getElementById("graph-nav-domain"); 
    let width = graphContainer.clientWidth;
    let height = graphContainer.clientHeight;

    const scale = 0.025;
    const { x, y } = d3.select(event.currentTarget).datum();
    const newX = (width / 2) - (x * scale);
    const newY = (height / 2) - (y * scale);
    
    const svg = d3.select("#graphSvg");
    const transform = d3.zoomIdentity.translate(newX, newY).scale(scale);
    await svg.transition().duration(800).call(zoomBehaviour.transform, transform);    

    if (globalSimulation) {
        const edgesData = await getJsonData("edges");
        const nodesData = await getJsonData("nodes");
        await addRelatedNodes(nodeData, globalSimulation, edgesData, nodesData);
    };

    updateNodeSidebar(nodeData, transcriptData.transcript);
    getMostSimilarNodes(topTalksCount);

    return event.currentTarget;
};
export function selectRandomNode() {
    const nodes = d3.selectAll("g").nodes(); 
    if (nodes.length === 0) return; 

    let randomNode;
    let data;

    do {
        let randomIndex = Math.floor(Math.random() * nodes.length);
        randomNode = d3.select(nodes[randomIndex]); // select random node
        data = randomNode.datum();
    } while (!data);

    // call selectedNode
    selectNode({ currentTarget: randomNode.node() }, data, true);
    resetUI();
};


// HELPER FUNCTIONS
function resetUI(){
    setSimilaritySpanValue('Click "Find similar talk"');
    resetEdgeColors();
    toggleCategories(false);

    showSidebar();
};

async function setSimilarityModal(talkId){
    const similarityScore = document.getElementById("similarity-score-modal");
    similarityScore.innerText = "calculating...";

    let selectedNodeElement = getSelectedNode();
    if (!selectedNodeElement) return;
    let nodeData = selectedNodeElement.datum();

    let { edgesList, nodesList } = await getConnectedNodesList(nodeData, connectedNodesLimit);
    if (edgesList.length === 0 && nodesList.length === 0) return;

    for (let i = 0; i < edgesList.length; i++) {
        if (talkId === edgesList[i].source || talkId === edgesList[i].target) {
            similarityScore.innerText = `${edgesList[i].weight}`;
            return
        };
    };
};


console.log("FIX -- circular import");