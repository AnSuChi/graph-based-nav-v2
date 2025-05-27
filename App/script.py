import os
import re
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import json

# directory paths
transcript_folder = "App/data/sourceData/stm"
mapping_json_path = "App/data/maptitle.json"
topics_json_path = "App/data/selectedtopics.json"
output_folder = "App/data"


model = SentenceTransformer("all-mpnet-base-v2")

transcript_files = [fname for fname in os.listdir(transcript_folder) if fname.endswith(".stm")]


# parse and filter
def parse_stm_file(file_path):
    transcript_text = []

    with open(file_path, 'r') as file:
        lines = file.readlines()

    for line in lines:
        match = re.match(r"(\S+) (\d+) (\S+) (\S+) (\S+) <.*> (.*)", line)
        if match:
            text = match.group(6)
            cleaned_text = text.replace('<unk>', '').strip()
            if cleaned_text:
                transcript_text.append(cleaned_text)

    return " ".join(transcript_text)

# creating embeddings
def get_embedding(text):
    embedding = model.encode(text)
    if embedding is None or len(embedding) == 0:
        raise ValueError("Empty embedding")
    return embedding

def compare_transcripts(transcript_embeddings, file_names):
    similarity_matrix = cosine_similarity(transcript_embeddings)
    similarities = []
    num_files = len(file_names)

    for i in range(num_files):
        for j in range(i + 1, num_files):
            similarities.append({
                "source": file_names[i],
                "target": file_names[j],
                "similarity": similarity_matrix[i][j]
            })

    similarities.sort(key=lambda x: x["similarity"], reverse=True)
    return similarities

with open(mapping_json_path, 'r') as map_file:
    title_mapping = json.load(map_file)

with open(topics_json_path, 'r') as topic_file:
    topic_mapping = json.load(topic_file)

title_dict = {item.get("Identifier", ""): item.get("Title", "Unknown Title") for item in title_mapping}
topic_dict = {stm: topic for topic, stm_files in topic_mapping.items() for stm in stm_files}  

transcripts = [parse_stm_file(os.path.join(transcript_folder, f)) for f in transcript_files]

if len(transcripts) == 0:
    print("No transcripts found!")
    exit(1)

valid_embeddings = []
for text in transcripts:
    try:
        embedding = get_embedding(text)
        valid_embeddings.append(embedding)
    except ValueError as error:
        print(f"Error: {error}")
    
if len(valid_embeddings) == 0:
    print("No valid embeddings found")
    exit(1)

embeddings = np.vstack(valid_embeddings)
similarities = compare_transcripts(embeddings, transcript_files)

nodes_data = { "nodes": [] }
edges_data = { "edges": [] }
unique_nodes = {}

min_similarity_score = 0.5
node_id = 0

for similarityData in similarities:
    for speakerData in [similarityData['source'], similarityData['target']]:
        if speakerData not in unique_nodes:
            identifier = speakerData.replace(".stm", "")  
            full_title_value = title_dict.get(identifier, speakerData) 
            speaker_name = full_title_value.split(":")[0] if ":" in full_title_value else full_title_value  
            title = full_title_value.split(": ", 1)[1] if ": " in full_title_value else full_title_value
            identifier = f"{identifier}"
            topic = topic_dict.get(speakerData, "Unknown")

            # skip entry check
            if topic == "Unknown" and title.endswith(".stm"):
                continue  

            nodes_data["nodes"].append({
                "id": node_id,
                "identifier": identifier,
                "title": title.capitalize(),
                "speaker": speaker_name,
                "topic": topic
            })
            unique_nodes[speakerData] = node_id
            node_id += 1

for similarityData in similarities:
    if similarityData['similarity'] >= min_similarity_score:
        if similarityData['source'] in unique_nodes and similarityData['target'] in unique_nodes:
            edges_data["edges"].append({
                "source": unique_nodes[similarityData['source']],
                "target": unique_nodes[similarityData['target']],
                "weight": round(float(similarityData['similarity']), 3)
            })
        else:
            continue  


os.makedirs(output_folder, exist_ok=True)  # create folder if it doesn't already exist
nodes_json_file = os.path.join(output_folder, "nodes.json")
edges_json_file = os.path.join(output_folder, "edges.json")

with open(nodes_json_file, 'w') as json_file:
    json.dump(nodes_data, json_file, indent=4)

with open(edges_json_file, 'w') as json_file:
    json.dump(edges_data, json_file, indent=4)


# create the transcripts folder + json files
for fname in transcript_files:
    transcript_text = parse_stm_file(os.path.join(transcript_folder, fname))
    identifier = fname.replace(".stm", "")

    transcript_path = os.path.join(output_folder, "transcripts", f"{identifier}.json")
    os.makedirs(os.path.dirname(transcript_path), exist_ok=True)
    with open(transcript_path, 'w') as transcript_file:
        json.dump({
            "id": identifier,
            "transcript": transcript_text
        }, transcript_file, indent=2)