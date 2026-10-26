import logging
from typing import Any, Dict, List
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from app.core.config import settings
from app.jobs.tasks import run_cleanup_expired_data, run_daily_reconciliation, run_scheduled_sync

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone=settings.TIMEZONE)


def setup_scheduler():
    """Configura os agendamentos das janelas e tarefas periódicas conforme DTI §6.4 e §13."""
    # Janelas diárias de sincronização: 07:00, 13:30, 20:30
    scheduler.add_job(
        run_scheduled_sync,
        CronTrigger(hour=7, minute=0, timezone=settings.TIMEZONE),
        id="sync_morning_07_00",
        name="Sincronização Matinal (07:00)",
        replace_existing=True,
    )
    scheduler.add_job(
        run_scheduled_sync,
        CronTrigger(hour=13, minute=30, timezone=settings.TIMEZONE),
        id="sync_afternoon_13_30",
        name="Sincronização Vespertina (13:30)",
        replace_existing=True,
    )
    scheduler.add_job(
        run_scheduled_sync,
        CronTrigger(hour=20, minute=30, timezone=settings.TIMEZONE),
        id="sync_night_20_30",
        name="Sincronização Noturna (20:30)",
        replace_existing=True,
    )

    # Reconciliação diária na madrugada: 03:00
    scheduler.add_job(
        run_daily_reconciliation,
        CronTrigger(hour=3, minute=0, timezone=settings.TIMEZONE),
        id="reconciliation_daily_03_00",
        name="Reconciliação Diária de Eventos (03:00)",
        replace_existing=True,
    )

    # Limpeza semanal: Domingo às 04:00
    scheduler.add_job(
        run_cleanup_expired_data,
        CronTrigger(day_of_week="sun", hour=4, minute=0, timezone=settings.TIMEZONE),
        id="cleanup_weekly_sun_04_00",
        name="Limpeza Semanal de Sessões e Eventos Expirados",
        replace_existing=True,
    )


def start_scheduler():
    """Inicia o agendador no processo da API."""
    if not scheduler.running:
        setup_scheduler()
        scheduler.start()
        logger.info("APScheduler iniciado com sucesso (Timezone: %s).", settings.TIMEZONE)


def shutdown_scheduler():
    """Encerra o agendador de forma graciosa."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler encerrado.")


def get_scheduler_info() -> Dict[str, Any]:
    """Retorna o estado operacional e os próximos horários de execução dos jobs."""
    jobs_info: List[Dict[str, Any]] = []
    for job in scheduler.get_jobs():
        next_run = job.next_run_time.isoformat() if getattr(job, "next_run_time", None) else None
        jobs_info.append({
            "id": job.id,
            "name": job.name,
            "next_run_time": next_run,
        })

    return {
        "running": scheduler.running,
        "timezone": str(scheduler.timezone),
        "total_jobs": len(jobs_info),
        "jobs": jobs_info,
    }
