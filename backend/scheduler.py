import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

_scheduler = BackgroundScheduler()


def _run_briefing() -> None:
    """Fired by APScheduler daily at configured briefing times. Runs the full graph."""
    # Import here to avoid circular imports at module load
    from backend.graph import graph
    from backend.config import config

    logger.info("Scheduler: starting daily briefing run")
    initial_state = {
        "location": config.location,
        "topics": config.topics,
        "user_name": config.user_name,
        "errors": [],
    }
    try:
        graph.invoke(initial_state)
        logger.info("Scheduler: daily briefing completed")
    except Exception as exc:
        logger.error("Scheduler: briefing failed — %s", exc)


def _configured_times() -> list[str]:
    from backend.config import config

    times = getattr(config, "briefing_times", None)
    if not times:
        times = [getattr(config, "briefing_time", "07:00")]
    if isinstance(times, str):
        times = [times]
    return list(dict.fromkeys(t for t in times if t))


def _schedule_jobs() -> None:
    from backend.config import config

    timezone: str = getattr(config, "timezone", "UTC")
    _scheduler.remove_all_jobs()

    for index, time_str in enumerate(_configured_times()):
        hour, minute = map(int, time_str.split(":"))
        _scheduler.add_job(
            _run_briefing,
            CronTrigger(hour=hour, minute=minute, timezone=timezone),
            id=f"daily_briefing_{index}",
            replace_existing=True,
        )

    logger.info(
        "Scheduler: daily briefing scheduled at %s (%s)",
        ", ".join(_configured_times()),
        timezone,
    )


def start_scheduler() -> None:
    """Schedule all configured briefing times and start the background scheduler."""
    _schedule_jobs()
    if not _scheduler.running:
        _scheduler.start()


def reschedule_briefings() -> None:
    """Refresh scheduler jobs after config changes."""
    if _scheduler.running:
        _schedule_jobs()


def shutdown_scheduler() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
