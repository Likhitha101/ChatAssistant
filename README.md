# ChatAssistant
Sam: Your Product Support Assistant 🤖
Hi! I'm Likhitha, and this is Sam, a custom-built support agent. I built this to help users get quick answers to common product questions (like returns and shipping) without waiting for a human.

Sam is "grounded," meaning he only answers based on the provided docs.json file. If the answer isn't in our guides, Sam won't make things up (no hallucinations!).

🚀 How to get Sam running
Since this project has both a React frontend and a Node.js backend, you'll need to set up both.

1. Backend Setup
Open your terminal in the main folder.

Install dependencies:

Bash
npm install
Create a .env file and add your OpenRouter key:

Plaintext
OPENROUTER_API_KEY=your_key_here
Start the server:

Bash
node server.js
The server runs on http://localhost:3000 and will automatically create the SQLite database for you.

2. Frontend Setup
Open a new terminal window.

Go into the frontend folder:

Bash
cd frontend
Install dependencies:

Bash
npm install
Start the React app:

Bash
npm start
🛠️ What’s under the hood?
React Frontend: A clean, modern chat interface. It uses localStorage to remember your chat session even if you refresh the page.

Node.js & Express: The brains of the operation.

Semantic Search: Instead of just looking for keywords, Sam uses Embeddings to understand the meaning of your questions.

Fuzzy Matching: I used Fuse.js so Sam can handle greetings ("Hi", "Hello") and small typos without using up API credits.

SQLite: All messages are saved in a local database so the conversation history stays persistent.
