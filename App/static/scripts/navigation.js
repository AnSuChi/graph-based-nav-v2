// IMPORTS
import { 
    trackSelectedNodes, 
    getSelectedNode, 
    colorScale,
    getJsonData,
    unselectNode, 
    setSelectedNode, 
    setSimilaritySpanValue,
    resetEdgeColors,
    toggleCategories,
    connectedNodesLimit,
    getTranscriptData,
    addRelatedNodes,
    globalSimulation,
    zoomBehaviour
} from "./app.js"; 

// GLOBAL VARIABLES
export let currentNodeIndex = 0;
let topTalksCount = 3; // warning: remember setting it less than or equal to "connectedNodesLimit" variable!
let sameNodeSelected = null;
const audioFolderPath = "/Users/suchi/Personal/Projects/graph-based-nav";

const secondaryControllerElement = document.getElementById("secondary-traversal-controller");
const audioSourceElement = document.getElementById("tedTalk-audio");
const nodeInfoContainer = document.getElementById("node-info-container");

const displayControlElements = [
    { element: secondaryControllerElement, key: "displayController" },
    { element: audioSourceElement, key: "displayAudio" },
    { element: nodeInfoContainer, key: "displayNodeInfo" },
];


// SELECT FUNCTIONS
export async function selectNode(event, nodeData, addToListIsTrue) {
    if (sameNodeSelected === nodeData) return;

    sameNodeSelected = nodeData;
    setSimilaritySpanValue('Click "Find similar talk"');
    resetEdgeColors();
    toggleCategories(false);
    currentNodeIndex = 0;

    for (let i = 0; i < displayControlElements.length; i++) {
        let { element, key } = displayControlElements[i];
        if (element.dataset[key] !== "true") {
            element.dataset[key] = "true";
        };
    };

    trackSelectedNodes.addNode(nodeData, addToListIsTrue);
    trackSelectedNodes.addNodeElement(event.currentTarget, addToListIsTrue)

    // reset all nodes
    d3.selectAll("g").attr("data-selected", null)
        .select("circle")
        .transition().duration(300)
        .attr("r", 500)
        .attr("fill", data => colorScale(data.topic));

    d3.selectAll("g").select("text")
        .text(data => nodeData.title.length > 45 ? nodeData.title.slice(0, 45) + "..." : nodeData.title)
        .transition().duration(300)
        .attr("font-size", "40px");

    // effects for the clicked node
    d3.select(event.currentTarget).attr("data-selected", "true")
        .select("circle")
        .transition().duration(300)
        .attr("r", 1200);

    d3.select(event.currentTarget).select("text")
        .text(nodeData.title)
        .transition().duration(300)
        .attr("font-size", "100px");

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

    updateNodeSidebar(nodeData);
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
};

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
};

export function navigateSimilarNodes(edgesList, nodesList){
    resetEdgeColors();
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

    setSimilaritySpanValue(nextEdgeData.weight);

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
        nodeTitleP.setAttribute('data-tooltip', `${nodesList[i].title}`);
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




// UI
export function updateNodeSidebar(data) {
    let titleElement = document.getElementById("node-title");
    let speakerElement = document.getElementById("node-speaker");
    let topicElement = document.getElementById("node-topic");
    const transcriptAreaDiv = document.getElementById("transcript-area-container");

    titleElement.innerText = `${data.title}`;
    speakerElement.innerText = `By: ${data.speaker}`;
    topicElement.innerText = `| Topic: ${data.topic} |`;
    audioSourceElement.src = `${audioFolderPath}${data.identifier}.mp3`;
    audioSourceElement.load();    

    transcriptAreaDiv.style.display = "block";    
    toggleTranscript(`${data.identifier}`, "ordinary");
};

export function resetSidebar(){
   for (let i = 0; i < displayControlElements.length; i++) {
    let { element, key } = displayControlElements[i];
        if (element.dataset[key] !== "false") {
            element.dataset[key] = "false";
        };
    };
};

function viewTalkDetails(node, talkId){
    document.body.classList.add('no-scroll');

    const modalContainer = document.getElementById("modal-container");
    const modalTitle = document.getElementById("modal-title");
    const modalExtra = document.getElementById("modal-extra");
    const modalSecondaryTitle = document.getElementById("modal-secondary-title");

    modalTitle.innerText = `| Topic: ${node.topic} |`;
    modalExtra.innerHTML = `Speaker - ${node.speaker}`;
    modalSecondaryTitle.innerText = `${node.title}`;
    setSimilarityModal(talkId);

    modalContainer.style.display = "block";

    toggleTranscript(`${node.identifier}`, "modal");
};

export function resetTranscript(transcriptTypeVar){
    let transcriptType = transcriptTypeVar === "modal" ? "modal-" : "";

    const transcriptArea = document.getElementById(`${transcriptType}transcript-area`);

    transcriptArea.style.maxHeight = "0";
    transcriptArea.style.transition = "max-height 0.4s ease, opacity 0.4s ease";
    transcriptArea.style.opacity = 0;
};
async function toggleTranscript(identifier, transcriptTypeVar){
    const transcriptData = await getTranscriptData(identifier);

    let transcriptType = transcriptTypeVar === "modal" ? "modal-" : "";

    const transcriptBtn = document.getElementById(`${transcriptType}transcript-btn`);
    const transcriptArea = document.getElementById(`${transcriptType}transcript-area`);
    const transcriptActionSpan = document.getElementById(`${transcriptType}transcript-action`);

    // textarea css, hide it initially
    resetTranscript(transcriptType);

    transcriptActionSpan.innerText = "Show";

    let isVisible = false;

    // toggle show and hide with animation
    transcriptBtn.addEventListener("click", () => {
        isVisible = !isVisible;

        if (isVisible) {
            transcriptArea.style.maxHeight = "150px";
            transcriptArea.style.opacity = 0.8;
            transcriptArea.style.overflowY = "scroll";
            transcriptActionSpan.innerText = "Hide";

        } else {
            transcriptArea.style.maxHeight = "0";
            transcriptArea.style.opacity = 0;
            transcriptActionSpan.innerText = "Show";
        }
    });

    transcriptArea.innerText = transcriptData.transcript;
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

function closeModal() {
    const modalContainer = document.getElementById("modal-container");
    const modalTranscriptArea = document.getElementById("modal-transcript-area");

    // closing animation for textarea
    modalTranscriptArea.style.maxHeight = "0";
    modalTranscriptArea.style.opacity = "0";

    // let animation finish before hiding the modal and resetting
    setTimeout(() => {
        modalTranscriptArea.innerText = "";
        modalContainer.style.display = "none";
        document.body.classList.remove('no-scroll');
    }, 100); // 100 = 0.1s
}



// EVENT LISTENERS
document.getElementById("close-modal-btn").addEventListener("click", () => {
    closeModal();
});

console.log("FIX -- circular import");