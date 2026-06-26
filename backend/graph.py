from langgraph.graph import END, START, StateGraph
from backend.state import AgentState
from backend.nodes.news_agent import news_agent
from backend.nodes.weather_agent import weather_agent
from backend.nodes.traffic_agent import traffic_agent
from backend.nodes.schedule_agent import schedule_agent
from backend.nodes.merger import merger


def build_graph() -> StateGraph:
    g = StateGraph(AgentState)

    # Four independent agents — added as separate nodes so LangGraph runs them in parallel
    g.add_node("news", news_agent)
    g.add_node("weather", weather_agent)
    g.add_node("traffic", traffic_agent)
    g.add_node("schedule", schedule_agent)
    g.add_node("merger", merger)

    # All four agents start in parallel.
    g.add_edge(START, "news")
    g.add_edge(START, "weather")
    g.add_edge(START, "traffic")
    g.add_edge(START, "schedule")

    # All four converge into merger, then done.
    g.add_edge("news", "merger")
    g.add_edge("weather", "merger")
    g.add_edge("traffic", "merger")
    g.add_edge("schedule", "merger")
    g.add_edge("merger", END)

    return g.compile()


# Compiled graph — imported by main.py and scheduler.py
graph = build_graph()
