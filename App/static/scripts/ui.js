import { 
    getSelectedNode, 
    getTranscriptData,
} from "./app.js"; 
import { 
    getConnectedNodesList
} from "./navigation.js"; 


// GLOBAL VARIABLES
const audioFolderPath = "/static/audio/";
const secondaryControllerElement = document.getElementById("secondary-traversal-controller");
const audioSourceElement = document.getElementById("tedTalk-audio");
const nodeInfoContainer = document.getElementById("node-info-container");

export const displayControlElements = [
    { element: secondaryControllerElement, key: "displayController" },
    { element: audioSourceElement, key: "displayAudio" },
    { element: nodeInfoContainer, key: "displayNodeInfo" },
];

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

export function viewTalkDetails(node, talkId){
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

export function closeModal() {
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
};

// UI
export function setSimilaritySpanValue(value){
    document.getElementById("similarity-score").textContent = `${value}`;
};

export function resetEdgeColors(){
    d3.selectAll("line")
    .style("stroke", "black") 
    .style("stroke-width", edge => edge.weight * ((edge.weight*100) - 10));
};

export function displayTraversalController(){
    const traversalControllerDiv = document.getElementById("explore-collection-controller");
    traversalControllerDiv.style.display = "block";
};