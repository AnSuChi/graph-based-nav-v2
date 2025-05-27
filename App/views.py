# Contains the routes/controllers for the app
import os

from flask import Blueprint, render_template, send_from_directory, current_app

views = Blueprint('views', __name__)


# serve json files from 'data' directory
@views.route('/data/<filename>')
def get_json_file(filename):
    return send_from_directory(os.path.join(current_app.root_path, 'data'), filename)

@views.route('/data/transcripts/<path:filename>')
def get_transcript_file(filename):
    transcripts_folder = os.path.join(current_app.root_path, 'data', 'transcripts')
    return send_from_directory(transcripts_folder, filename)



@views.route('/')
def index():
    return render_template("index.html", active_page = "explore")

@views.route('/userGuide')
def user_guide():
    return render_template("userGuide.html", active_page= "userGuide")