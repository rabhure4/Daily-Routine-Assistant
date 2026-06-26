from functools import lru_cache
from backend.config import config


def _chat_openai_kwargs() -> dict:
    import httpx

    return {
        "timeout": 45,
        "max_retries": 1,
        "http_client": httpx.Client(verify=config.external_api_verify_tls),
    }


@lru_cache(maxsize=16)
def _build_llm(provider: str, model: str):
    if provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model=model, api_key=config.openai_api_key, **_chat_openai_kwargs())

    if provider == "openrouter":
        if not config.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY not set")
        from langchain_openai import ChatOpenAI
        # OpenRouter exposes an OpenAI-compatible chat completions API, so the
        # LangChain OpenAI client is used with OpenRouter's base URL and headers.
        return ChatOpenAI(
            model=model,
            api_key=config.openrouter_api_key,
            base_url=config.openrouter_base_url,
            **_chat_openai_kwargs(),
            default_headers={
                "HTTP-Referer": config.openrouter_site_url,
                "X-Title": config.openrouter_app_name,
            },
        )

    if provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(model=model, google_api_key=config.gemini_api_key)

    if provider == "ollama":
        from langchain_ollama import ChatOllama
        return ChatOllama(model=model, base_url=config.ollama_base_url)

    raise ValueError(f"Unknown LLM_PROVIDER: '{provider}'. Choose openai | openrouter | gemini | ollama")


def get_llm():
    """Return a LangChain chat model based on LLM_PROVIDER and LLM_MODEL."""
    if not config.llm_provider:
        raise ValueError("LLM_PROVIDER is not set")
    if not config.llm_model:
        raise ValueError("LLM_MODEL is not set")
    return _build_llm(config.llm_provider, config.llm_model)
