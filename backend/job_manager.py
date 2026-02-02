"""
Background Job Manager for Bulk Import
Handles long-running import tasks with progress tracking
"""
import asyncio
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from dataclasses import dataclass, field
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class ImportJob:
    id: str
    status: JobStatus = JobStatus.PENDING
    total_rows: int = 0
    processed: int = 0
    imported: int = 0
    duplicates: int = 0
    errors: int = 0
    skipped: int = 0
    corporate_client: str = ""
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    details: list = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "status": self.status.value,
            "total_rows": self.total_rows,
            "processed": self.processed,
            "imported": self.imported,
            "duplicates": self.duplicates,
            "errors": self.errors,
            "skipped": self.skipped,
            "corporate_client": self.corporate_client,
            "progress_percent": round((self.processed / self.total_rows * 100) if self.total_rows > 0 else 0, 1),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "error_message": self.error_message,
            "details": self.details[-50:] if self.details else []  # Last 50 details
        }


class JobManager:
    """Manages background import jobs"""
    
    def __init__(self):
        self._jobs: Dict[str, ImportJob] = {}
        self._tasks: Dict[str, asyncio.Task] = {}
    
    def create_job(self, total_rows: int, corporate_client: str) -> ImportJob:
        """Create a new import job"""
        job_id = str(uuid.uuid4())
        job = ImportJob(
            id=job_id,
            total_rows=total_rows,
            corporate_client=corporate_client,
            started_at=datetime.utcnow()
        )
        self._jobs[job_id] = job
        logger.info(f"Created import job {job_id} for {total_rows} rows")
        return job
    
    def get_job(self, job_id: str) -> Optional[ImportJob]:
        """Get job by ID"""
        return self._jobs.get(job_id)
    
    def update_job(self, job_id: str, **kwargs):
        """Update job progress"""
        job = self._jobs.get(job_id)
        if job:
            for key, value in kwargs.items():
                if hasattr(job, key):
                    setattr(job, key, value)
    
    def add_detail(self, job_id: str, detail: Dict[str, Any]):
        """Add a detail entry to the job"""
        job = self._jobs.get(job_id)
        if job:
            job.details.append(detail)
    
    def start_task(self, job_id: str, coro):
        """Start a background task for a job"""
        task = asyncio.create_task(coro)
        self._tasks[job_id] = task
        return task
    
    def cancel_job(self, job_id: str) -> bool:
        """Cancel a running job"""
        task = self._tasks.get(job_id)
        if task and not task.done():
            task.cancel()
            job = self._jobs.get(job_id)
            if job:
                job.status = JobStatus.CANCELLED
                job.completed_at = datetime.utcnow()
            return True
        return False
    
    def complete_job(self, job_id: str, success: bool = True, error_message: str = None):
        """Mark job as completed"""
        job = self._jobs.get(job_id)
        if job:
            job.status = JobStatus.COMPLETED if success else JobStatus.FAILED
            job.completed_at = datetime.utcnow()
            job.error_message = error_message
            logger.info(f"Job {job_id} completed: {job.imported} imported, {job.duplicates} duplicates, {job.errors} errors")
    
    def list_jobs(self, limit: int = 10) -> list:
        """List recent jobs"""
        jobs = sorted(
            self._jobs.values(),
            key=lambda j: j.started_at or datetime.min,
            reverse=True
        )
        return [j.to_dict() for j in jobs[:limit]]
    
    def cleanup_old_jobs(self, max_age_hours: int = 24):
        """Remove completed jobs older than max_age_hours"""
        now = datetime.utcnow()
        to_remove = []
        for job_id, job in self._jobs.items():
            if job.completed_at:
                age = (now - job.completed_at).total_seconds() / 3600
                if age > max_age_hours:
                    to_remove.append(job_id)
        
        for job_id in to_remove:
            del self._jobs[job_id]
            if job_id in self._tasks:
                del self._tasks[job_id]
        
        if to_remove:
            logger.info(f"Cleaned up {len(to_remove)} old import jobs")


# Global job manager instance
job_manager = JobManager()
