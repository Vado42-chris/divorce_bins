import sys
import json
import requests
import textwrap
import os
from flight_recorder import log_event
from ollama_service import query_ollama

# FORTRESS CONFIG
MAX_CHUNK_TOKENS = 3000  # Conservative window for Mistral/Llama3
OLLAMA_URL = "http://localhost:11434/api/generate"

def call_ollama(prompt, system_prompt, model="mistral", temperature=0.7):
    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": model,
                "prompt": f"{system_prompt}\n\nUser: {prompt}",
                "stream": False,
                "options": {"temperature": temperature}
            },
            timeout=120
        )
        if response.status_code == 200:
            return response.json().get('response', '')
        return f"Error: {response.status_code}"
    except Exception as e:
        return f"Exception: {str(e)}"

def generate_sliding_window_synthesis(payload):
    """
    Implements Sliding-Window Synthesis to prevent Brain-Fog.
    Chunks long contexts, synthesizes each, then performs a global verification pass.
    """
    context = payload.get('context', '')
    fact = payload.get('fact', '')
    p_type = payload.get('type', 'general')
    
    # 1. Chunking
    words = context.split()
    chunks = [" ".join(words[i:i + MAX_CHUNK_TOKENS]) for i in range(0, len(words), MAX_CHUNK_TOKENS)]
    
    # Ensure at least one chunk exists
    if not chunks:
        chunks = ["No specific context provided."]

    partial_summaries = []
    
    system_prompts = {
        'adversarial_review': "You are 'Antigravity Adversary'. Identify logical gaps and counter-explanations.",
        'deposition_prep': "You are 'Antigravity Strategist'. Draft aggressive cross-examination questions.",
        'rebuttal_generator': "You are 'Antigravity Strategist'. Draft tactical rebuttals anchored in evidence.",
        'impeachment': "You are 'Antigravity Strategist'. Draft impeachment narratives from contradictions.",
        'general': "You are 'Senior Judicial Analyst'. Draft formal Chronicled Judicial Briefs for the Saskatchewan Court of King's Bench. Every evidence claim MUST be followed by its Bates-stamp or Archive File Link in parentheses (e.g., ARCHIVE: sms/2024-04-19.md)."
    }
    
    s_prompt = system_prompts.get(p_type, system_prompts['general'])
    
    # 2. Parallel/Serial Synthesis per Chunk
    for i, chunk in enumerate(chunks):
        chunk_prompt = f"CHUNK {i+1}/{len(chunks)} Context: {chunk}\nTarget Fact: {fact}\nSummarize logical implications. Ensure all claims cite their Bates-stamp or Archive File Link."
        partial_summaries.append(call_ollama(chunk_prompt, s_prompt))

    # 3. Final Synthesis & Verification Pass (The Scalpel)
    final_prompt = (
        f"Consolidate partial syntheses into a cohesive {p_type} brief.\n"
        f"CRITICAL: Do not hallucinate. Verify names/dates.\n"
        f"Partial Synths:\n" + "\n---\n".join(partial_summaries)
    )
    
    raw_brief = call_ollama(final_prompt, s_prompt)
    
    # Verification pass (Low Temperature)
    verifier_prompt = (
        f"Audit brief for hallucinations. Wrap unverified facts in [UNVERIFIED].\n"
        f"Brief: {raw_brief}"
    )
    
    verified_brief = call_ollama(verifier_prompt, "Precision Fact-Checker.", temperature=0.1)
    
    return verified_brief

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python strategist.py '<json_payload>'")
        sys.exit(1)
        
    try:
        payload = json.loads(sys.argv[1])
        result = generate_sliding_window_synthesis(payload)
        print(result)
    except Exception as e:
        print(f"FAILED: {str(e)}")
