import requests
import json

OLLAMA_URL = "http://localhost:11434/api/generate"

def query_ollama(prompt, model="llama3"):
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False
    }
    try:
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        return response.json().get("response", "No response from Ollama.")
    except Exception as e:
        return f"Error connecting to Ollama: {e}"

def summarize_evidence(text):
    prompt = f"Please summarize the following piece of evidence for a legal case. Extract key dates, names, and events:\n\n{text}"
    return query_ollama(prompt)

if __name__ == "__main__":
    # result = query_ollama("Hello!")
    # print(result)
    pass
