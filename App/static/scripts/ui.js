// GLOBALS
let showCloseCategoriesBtn = false;

const audioFolderPath = "/static/audio/";
const secondaryControllerElement = document.getElementById("secondary-traversal-controller");
const audioSourceElement = document.getElementById("tedTalk-audio");
const nodeInfoContainer = document.getElementById("node-info-container");

export const displayControlElements = [
    { element: secondaryControllerElement, key: "displayController" },
    { element: audioSourceElement, key: "displayAudio" },
    { element: nodeInfoContainer, key: "displayNodeInfo" },
];




export function resetTranscript(transcriptTypeVar){
    let transcriptType = transcriptTypeVar === "modal" ? "modal-" : "";

    const transcriptArea = document.getElementById(`${transcriptType}transcript-area`);

    transcriptArea.style.maxHeight = "0";
    transcriptArea.style.transition = "max-height 0.4s ease, opacity 0.4s ease";
    transcriptArea.style.opacity = 0;
};

export function displayTraversalController(){
    const traversalControllerDiv = document.getElementById("explore-collection-controller");
    traversalControllerDiv.style.display = "block";
};

export function updateCategoryUI(selectedCategory, categoryBtnId){
    const categoryMsg = document.getElementById("category-msg");

    const categoryBtns = document.querySelectorAll("#category-selection button");
    categoryBtns.forEach(btn => btn.classList.remove("categorySelectedBtn"));
    const categoryBtn = document.getElementById(categoryBtnId.toString());
    categoryBtn.classList.add("categorySelectedBtn");

    categoryMsg.innerText = `Selected category - ${selectedCategory}`;
};

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

export function setSimilaritySpanValue(value){
    document.getElementById("similarity-score").textContent = `${value}`;
};

export function resetEdgeColors(){
    d3.selectAll("line")
    .style("stroke", "black") 
    .style("stroke-width", edge => edge.weight * ((edge.weight*100) - 10));
};
export function highlightSearchRelevantNode(){
    d3.selectAll("circle")
    .style("stroke", "blue") 
    .style("stroke-width", 200);
};
export function resetSearchHighlightedNode(){
    d3.selectAll("circle")
    .style("stroke", "yellow") 
    .style("stroke-width", 200);
};

export function updateNodeSidebar(data, transcript) {
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
    toggleTranscript("ordinary", transcript);
};

export async function toggleTranscript(transcriptTypeVar, transcript){
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

    transcriptArea.innerText = transcript;
};

export function resetSidebar(){
   for (let i = 0; i < displayControlElements.length; i++) {
    let { element, key } = displayControlElements[i];
        if (element.dataset[key] !== "false") {
            element.dataset[key] = "false";
        };
    };
};
export function showSidebar(){
    for (let i = 0; i < displayControlElements.length; i++) {
        let { element, key } = displayControlElements[i];
        if (element.dataset[key] !== "true") {
            element.dataset[key] = "true";
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


export function setTalkDetails(node){
    document.body.classList.add('no-scroll');

    const modalContainer = document.getElementById("modal-container");
    const modalTitle = document.getElementById("modal-title");
    const modalExtra = document.getElementById("modal-extra");
    const modalSecondaryTitle = document.getElementById("modal-secondary-title");

    modalTitle.innerText = `| Topic: ${node.topic} |`;
    modalExtra.innerHTML = `Speaker - ${node.speaker}`;
    modalSecondaryTitle.innerText = `${node.title}`;
    modalContainer.style.display = "block";
};

export function resetNodes(nodeData){
    d3.selectAll("g").attr("data-selected", null)
        .select("circle")
        .transition().duration(300)
        .attr("r", 500)
        .attr("fill", "red");

    d3.selectAll("g").select("text")
        .text(data => nodeData.title.length > 45 ? nodeData.title.slice(0, 45) + "..." : nodeData.title)
        .transition().duration(300)
        .attr("font-size", "40px");
};
export function updateSelectedNodeStyle(nodeData, event){
    d3.select(event).attr("data-selected", "true")
        .select("circle")
        .transition().duration(300)
        .attr("r", 1200);

    d3.select(event).select("text")
        .text(nodeData.title)
        .transition().duration(300)
        .attr("font-size", "100px");
};