from fastapi import APIRouter, Depends
from app.api.deps import require_admin
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/system-status")
async def get_system_status(admin: User = Depends(require_admin)):
    """Rota administrativa protegida por require_admin."""
    return {
        "status": "operational",
        "admin_user": admin.email,
    }
