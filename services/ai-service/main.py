from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import httpx
import os
import json
from datetime import datetime
import requests
from github import Github
import ollama
import asyncio
from concurrent.futures import ThreadPoolExecutor
import aiohttp
from bs4 import BeautifulSoup
import re

app = FastAPI(title="AI Code Platform - AI Service", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    provider: Optional[str] = None
    model: Optional[str] = None
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 1000

class ProviderSettings(BaseModel):
    openai: Dict[str, Any]
    anthropic: Dict[str, Any]
    google: Dict[str, Any]

# Global variable to cache provider settings
provider_settings_cache = {}

async def get_user_provider_settings(user_id: str) -> ProviderSettings:
    """Fetch user provider settings from database service"""
    if user_id in provider_settings_cache:
        return ProviderSettings(**provider_settings_cache[user_id])

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://database-service:3003/settings/providers",
                headers={"x-user-id": user_id}
            )

            if response.status_code == 200:
                settings = response.json()
                provider_settings_cache[user_id] = settings
                return ProviderSettings(**settings)
            else:
                # Return default settings if user has no custom settings
                return ProviderSettings(
                    openai={"apiKey": "", "enabled": False},
                    anthropic={"apiKey": "", "enabled": False},
                    google={"apiKey": "", "enabled": False}
                )
    except Exception as e:
        print(f"Error fetching provider settings: {e}")
        # Return default settings on error
        return ProviderSettings(
            openai={"apiKey": "", "enabled": False},
            anthropic={"apiKey": "", "enabled": False},
            google={"apiKey": "", "enabled": False}
        )

def get_provider_client(provider: str, api_key: str = None):
    """Get the appropriate AI provider client"""
    if provider == "openai":
        from openai import OpenAI
        return OpenAI(api_key=api_key)
    elif provider == "anthropic":
        import anthropic
        return anthropic.Anthropic(api_key=api_key)
    elif provider == "google":
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        return genai
    elif provider == "ollama":
        # Ollama doesn't need API key, just return the client
        return ollama
    elif provider == "github":
        # For GitHub we need access token
        return Github(api_key) if api_key else Github()
    else:
        raise ValueError(f"Unsupported provider: {provider}")

def get_ollama_models(base_url: str = None):
    """Get available Ollama models"""
    try:
        client = ollama.Client(host=base_url) if base_url else ollama.Client()
        response = client.list()
        return [model['name'] for model in response.get('models', [])]
    except Exception as e:
        print(f"Error getting Ollama models: {e}")
        return []

async def fetch_github_repos(username: str, token: str = None):
    """Fetch GitHub repositories for a user"""
    try:
        if token:
            g = Github(token)
        else:
            g = Github()

        user = g.get_user(username)
        repos = user.get_repos()
        return [{
            'name': repo.name,
            'full_name': repo.full_name,
            'description': repo.description,
            'url': repo.html_url,
            'language': repo.language,
            'stars': repo.stargazers_count
        } for repo in repos[:10]]  # Limit to 10 repos
    except Exception as e:
        print(f"Error fetching GitHub repos: {e}")
        return []

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ai-service"}

@app.post("/chat")
async def chat_completion(request: ChatRequest, req: Request):
    """Handle chat completion requests"""
    user_id = req.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    # Get user provider settings
    settings = await get_user_provider_settings(user_id)

    # Determine which provider to use
    provider = request.provider
    if not provider:
        # Auto-select enabled provider
        if settings.openai.get("enabled"):
            provider = "openai"
        elif settings.anthropic.get("enabled"):
            provider = "anthropic"
        elif settings.google.get("enabled"):
            provider = "google"
        elif len(get_ollama_models()) > 0:
            provider = "ollama"
        else:
            raise HTTPException(
                status_code=400,
                detail="No AI provider enabled. Please configure your API keys in settings."
            )

    # Get API key for the selected provider (not needed for Ollama)
    api_key = ""
    if provider == "openai":
        api_key = settings.openai.get("apiKey", "")
    elif provider == "anthropic":
        api_key = settings.anthropic.get("apiKey", "")
    elif provider == "google":
        api_key = settings.google.get("apiKey", "")
    elif provider == "ollama":
        # Ollama doesn't need API key
        api_key = None

    if not api_key and provider in ["openai", "anthropic", "google"]:
        raise HTTPException(
            status_code=400,
            detail=f"API key not configured for {provider}. Please update your settings."
        )

    try:
        # Get provider client
        client = get_provider_client(provider, api_key)

        # Convert messages to provider format
        formatted_messages = []
        for msg in request.messages:
            if provider == "openai":
                formatted_messages.append({"role": msg.role, "content": msg.content})
            elif provider == "anthropic":
                formatted_messages.append({"role": msg.role, "content": msg.content})
            elif provider == "google":
                formatted_messages.append({"role": msg.role, "parts": [{"text": msg.content}]})

        # Make API call based on provider
        if provider == "openai":
            response = client.chat.completions.create(
                model=request.model or "gpt-3.5-turbo",
                messages=formatted_messages,
                temperature=request.temperature,
                max_tokens=request.max_tokens
            )
            content = response.choices[0].message.content

        elif provider == "anthropic":
            response = client.messages.create(
                model=request.model or "claude-3-sonnet-20240229",
                max_tokens=request.max_tokens,
                temperature=request.temperature,
                messages=formatted_messages
            )
            content = response.content[0].text

        elif provider == "google":
            model = client.GenerativeModel(request.model or "gemini-pro")
            response = model.generate_content(formatted_messages[0]["parts"][0]["text"])
            content = response.text

        elif provider == "ollama":
            # Use Ollama for local models
            messages_for_ollama = []
            for msg in request.messages:
                messages_for_ollama.append({
                    'role': msg.role,
                    'content': msg.content
                })

            response = client.chat(
                model=request.model or 'llama2',
                messages=messages_for_ollama,
                options={
                    'temperature': request.temperature,
                    'num_predict': request.max_tokens
                }
            )
            content = response['message']['content']

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")

        return {
            "content": content,
            "provider": provider,
            "model": request.model,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        print(f"AI API error: {e}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

@app.get("/providers")
async def list_providers(req: Request):
    """List available AI providers and their status"""
    user_id = req.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    settings = await get_user_provider_settings(user_id)
    ollama_models = get_ollama_models()

    providers = {
        "openai": {
            "name": "OpenAI",
            "enabled": settings.openai.get("enabled", False),
            "models": ["gpt-4", "gpt-3.5-turbo"],
            "type": "api"
        },
        "anthropic": {
            "name": "Anthropic",
            "enabled": settings.anthropic.get("enabled", False),
            "models": ["claude-3-opus-20240229", "claude-3-sonnet-20240229"],
            "type": "api"
        },
        "google": {
            "name": "Google AI",
            "enabled": settings.google.get("enabled", False),
            "models": ["gemini-pro", "gemini-pro-vision"],
            "type": "api"
        },
        "ollama": {
            "name": "Ollama",
            "enabled": len(ollama_models) > 0,
            "models": ollama_models,
            "type": "local",
            "has_custom_url": False
        },
        "github": {
            "name": "GitHub Integration",
            "enabled": True,
            "models": [],
            "type": "integration",
            "requires_auth": True
        }
    }

    return {"providers": providers}

@app.get("/github/user/{username}")
async def get_github_user(username: str, req: Request):
    """Get GitHub user information"""
    user_id = req.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    # Get user's GitHub token from settings
    settings = await get_user_provider_settings(user_id)
    token = settings.github.get("apiKey") if settings.github else None

    try:
        if token:
            g = Github(token)
        else:
            g = Github()

        user = g.get_user(username)
        return {
            'login': user.login,
            'name': user.name,
            'bio': user.bio,
            'location': user.location,
            'company': user.company,
            'blog': user.blog,
            'public_repos': user.public_repos,
            'followers': user.followers,
            'following': user.following,
            'avatar_url': user.avatar_url,
            'html_url': user.html_url
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"GitHub user {username} not found")

@app.get("/github/repos/{username}")
async def get_github_repos(username: str, req: Request):
    """Get GitHub repositories for a user"""
    user_id = req.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    # Get user's GitHub token from settings
    settings = await get_user_provider_settings(user_id)
    token = settings.github.get("apiKey") if settings.github else None

    repos = await fetch_github_repos(username, token)
    return {"repositories": repos}

@app.post("/ollama/models")
async def configure_ollama_model(req: Request):
    """Configure Ollama models and base URL"""
    user_id = req.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    data = await req.json()
    base_url = data.get('base_url')
    model_name = data.get('model_name')

    try:
        if base_url:
            # Test the custom base URL
            client = ollama.Client(host=base_url)
            response = client.list()
            available_models = [model['name'] for model in response.get('models', [])]

            if model_name and model_name not in available_models:
                # Try to pull the model
                client.pull(model_name)
                return {"status": "success", "message": f"Model {model_name} pulled successfully"}
            else:
                return {"status": "success", "available_models": available_models}
        else:
            # Use default Ollama setup
            client = ollama.Client()
            response = client.list()
            available_models = [model['name'] for model in response.get('models', [])]

            if model_name and model_name not in available_models:
                # Try to pull the model
                client.pull(model_name)
                return {"status": "success", "message": f"Model {model_name} pulled successfully"}
            else:
                return {"status": "success", "available_models": available_models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ollama configuration error: {str(e)}")

@app.get("/code-examples")
async def get_code_examples(query: str = "", language: str = "", req: Request = None):
    """Get professional code examples from various sources"""
    user_id = req.headers.get("x-user-id") if req else None

    try:
        async with aiohttp.ClientSession() as session:
            # Search on GitHub for code examples
            if query:
                g = Github()
                repos = g.search_repositories(query, sort='stars', order='desc')

                examples = []
                for repo in list(repos)[:5]:  # Get top 5 repos
                    # Try to get README or code files
                    try:
                        contents = repo.get_contents("")
                        readme = None
                        for content in contents:
                            if content.name.lower() in ['readme.md', 'readme.txt']:
                                readme = content.decoded_content.decode('utf-8')
                                break
                    except:
                        readme = f"Repository: {repo.name}"

                    examples.append({
                        'title': repo.name,
                        'description': repo.description or "No description available",
                        'language': repo.language,
                        'url': repo.html_url,
                        'stars': repo.stargazers_count,
                        'readme_snippet': readme[:200] + "..." if readme else None
                    })

                return {"examples": examples}
            else:
                return {"examples": []}
    except Exception as e:
        print(f"Error fetching code examples: {e}")
        return {"examples": []}

class GitOperationRequest(BaseModel):
    operation: str  # 'clone', 'checkout', 'status', 'commit', 'push'
    repoUrl: Optional[str] = None
    branch: Optional[str] = None
    message: Optional[str] = None
    files: Optional[List[str]] = None
    projectName: Optional[str] = None
    create: Optional[bool] = False

def detect_git_operations(message: str) -> List[GitOperationRequest]:
    """Detect git operations from user message"""
    operations = []
    message_lower = message.lower()
    
    # Clone detection
    clone_patterns = [
        r'clone\s+(.+?)(?:\s+|$)',
        r'git\s+clone\s+(.+?)(?:\s+|$)',
        r'pull\s+down\s+(.+?)(?:\s+|$)'
    ]
    for pattern in clone_patterns:
        match = re.search(pattern, message_lower)
        if match:
            repo_url = match.group(1).strip()
            operations.append(GitOperationRequest(
                operation='clone',
                repoUrl=repo_url,
                branch='main'  # default branch
            ))
    
    # Branch checkout detection
    checkout_patterns = [
        r'checkout\s+(?:branch\s+)?(.+?)(?:\s+|$)',
        r'switch\s+to\s+(?:branch\s+)?(.+?)(?:\s+|$)',
        r'git\s+checkout\s+(.+?)(?:\s+|$)'
    ]
    for pattern in checkout_patterns:
        match = re.search(pattern, message_lower)
        if match:
            branch_name = match.group(1).strip()
            create_branch = 'create' in message_lower or 'new' in message_lower
            operations.append(GitOperationRequest(
                operation='checkout',
                branch=branch_name,
                create=create_branch
            ))
    
    # Commit detection
    commit_patterns = [
        r'commit\s+(?:with message\s+)?["\'](.+?)["\']',
        r'git\s+commit\s+-m\s+["\'](.+?)["\']',
        r'save changes\s+(?:with message\s+)?["\'](.+?)["\']'
    ]
    for pattern in commit_patterns:
        match = re.search(pattern, message_lower)
        if match:
            commit_message = match.group(1).strip()
            operations.append(GitOperationRequest(
                operation='commit',
                message=commit_message
            ))
    
    # Push detection
    if any(word in message_lower for word in ['push', 'upload', 'sync changes']):
        operations.append(GitOperationRequest(operation='push'))
    
    # Status detection
    if any(word in message_lower for word in ['status', 'what changed', 'changes']):
        operations.append(GitOperationRequest(operation='status'))
    
    return operations

async def execute_git_operation(operation: GitOperationRequest, user_id: str) -> Dict[str, Any]:
    """Execute git operation via terminal service"""
    try:
        async with httpx.AsyncClient() as client:
            if operation.operation == 'clone':
                response = await client.post(
                    f"http://terminal-service:3004/git/clone",
                    json={
                        'repoUrl': operation.repoUrl,
                        'branch': operation.branch,
                        'userId': user_id,
                        'projectName': operation.projectName
                    }
                )
            elif operation.operation == 'checkout':
                response = await client.post(
                    f"http://terminal-service:3004/git/checkout",
                    json={
                        'branch': operation.branch,
                        'userId': user_id,
                        'create': operation.create
                    }
                )
            elif operation.operation == 'status':
                response = await client.get(
                    f"http://terminal-service:3004/git/status/{user_id}"
                )
            elif operation.operation == 'commit':
                response = await client.post(
                    f"http://terminal-service:3004/git/commit",
                    json={
                        'userId': user_id,
                        'message': operation.message,
                        'files': operation.files
                    }
                )
            elif operation.operation == 'push':
                response = await client.post(
                    f"http://terminal-service:3004/git/push",
                    json={
                        'userId': user_id,
                        'branch': operation.branch
                    }
                )
            else:
                return {'success': False, 'error': f'Unknown git operation: {operation.operation}'}
            
            if response.status_code == 200:
                return response.json()
            else:
                error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {'error': response.text}
                return {'success': False, 'error': error_data.get('error', 'Git operation failed')}
    
    except Exception as e:
        return {'success': False, 'error': str(e)}

@app.post("/git/execute")
async def execute_git_operations(request: ChatRequest, req: Request):
    """Execute git operations detected from chat message"""
    user_id = req.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    # Get the last user message
    user_message = None
    for msg in reversed(request.messages):
        if msg.role == 'user':
            user_message = msg.content
            break
    
    if not user_message:
        raise HTTPException(status_code=400, detail="No user message found")
    
    # Detect git operations
    operations = detect_git_operations(user_message)
    
    if not operations:
        return {'operations': [], 'message': 'No git operations detected'}
    
    # Execute operations
    results = []
    for operation in operations:
        result = await execute_git_operation(operation, user_id)
        results.append({
            'operation': operation.operation,
            'result': result
        })
    
    return {
        'operations': len(operations),
        'results': results
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
