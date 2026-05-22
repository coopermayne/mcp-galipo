"""
Financial API routes.

Handles case financial CRUD operations.
"""

import asyncio
from fastapi.responses import JSONResponse
from pydantic import ValidationError
import db
import auth
from schemas import CreateFinancialInput, UpdateFinancialInput
from .common import api_error, pydantic_error, clamp_pagination
from .sse import broadcast


def register_financial_routes(mcp):
    """Register financial management routes."""

    @mcp.custom_route("/api/v1/financials", methods=["GET"])
    async def api_list_financials(request):
        """List all case financials with optional filtering."""
        if err := auth.require_auth(request):
            return err
        resolution_type = request.query_params.get("resolution_type")
        is_finalized_param = request.query_params.get("is_finalized")
        is_finalized = None
        if is_finalized_param is not None:
            is_finalized = is_finalized_param.lower() == "true"
        search = request.query_params.get("search")
        limit, offset = clamp_pagination(request)

        attorney_ids_param = request.query_params.get("attorney_ids")
        attorney_ids = (
            [int(x) for x in attorney_ids_param.split(",")]
            if attorney_ids_param
            else None
        )

        result = await asyncio.to_thread(
            db.get_all_financials,
            resolution_type=resolution_type,
            is_finalized=is_finalized,
            attorney_ids=attorney_ids,
            search=search,
            limit=limit,
            offset=offset,
        )
        return JSONResponse({
            "financials": result["financials"],
            "total": result["total"],
        })

    @mcp.custom_route("/api/v1/financials/counts", methods=["GET"])
    async def api_financial_counts(request):
        """Get financial counts grouped by resolution type."""
        if err := auth.require_auth(request):
            return err
        attorney_ids_param = request.query_params.get("attorney_ids")
        attorney_ids = (
            [int(x) for x in attorney_ids_param.split(",")]
            if attorney_ids_param
            else None
        )
        counts = await asyncio.to_thread(db.get_resolution_type_counts, attorney_ids)
        return JSONResponse(counts)

    @mcp.custom_route("/api/v1/financials/by-case/{case_id}", methods=["GET"])
    async def api_get_financial_by_case(request):
        """Get the financial record for a case (one-to-one)."""
        if err := auth.require_auth(request):
            return err
        case_id = int(request.path_params["case_id"])
        financial = await asyncio.to_thread(db.get_financial_by_case, case_id)
        if not financial:
            return JSONResponse(None)
        return JSONResponse(financial)

    @mcp.custom_route("/api/v1/financials/{financial_id}", methods=["GET"])
    async def api_get_financial(request):
        """Get a specific financial record by ID."""
        if err := auth.require_auth(request):
            return err
        financial_id = int(request.path_params["financial_id"])
        financial = await asyncio.to_thread(db.get_financial_by_id, financial_id)
        if not financial:
            return api_error("Financial record not found", "NOT_FOUND", 404)
        return JSONResponse(financial)

    @mcp.custom_route("/api/v1/financials", methods=["POST"])
    async def api_create_financial(request):
        """Create a new financial record."""
        if err := auth.require_auth(request):
            return err
        try:
            data = CreateFinancialInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)
        result = await asyncio.to_thread(
            db.create_financial,
            data.case_id,
            **data.model_dump(exclude={"case_id"}, exclude_none=True),
        )
        broadcast({"entity": "financial", "action": "created", "id": result.get("id"), "case_id": data.case_id})
        return JSONResponse({"success": True, "financial": result})

    @mcp.custom_route("/api/v1/financials/{financial_id}", methods=["PUT"])
    async def api_update_financial(request):
        """Update an existing financial record."""
        if err := auth.require_auth(request):
            return err
        financial_id = int(request.path_params["financial_id"])
        try:
            data = UpdateFinancialInput(**(await request.json()))
        except ValidationError as e:
            return pydantic_error(e)
        updates = data.model_dump(exclude_none=True)
        result = await asyncio.to_thread(db.update_financial, financial_id, **updates)
        if not result:
            return api_error("Financial record not found", "NOT_FOUND", 404)
        broadcast({"entity": "financial", "action": "updated", "id": financial_id, "case_id": result.get("case_id")})
        return JSONResponse({"success": True, "financial": result})

    @mcp.custom_route("/api/v1/financials/{financial_id}", methods=["DELETE"])
    async def api_delete_financial(request):
        """Delete a financial record."""
        if err := auth.require_auth(request):
            return err
        financial_id = int(request.path_params["financial_id"])
        deleted = await asyncio.to_thread(db.delete_financial, financial_id)
        if deleted:
            broadcast({"entity": "financial", "action": "deleted", "id": financial_id})
            return JSONResponse({"success": True})
        return api_error("Financial record not found", "NOT_FOUND", 404)

    # =========================================================================
    # Counsel Fees
    # =========================================================================

    @mcp.custom_route("/api/v1/financials/{financial_id}/fees", methods=["POST"])
    async def api_create_counsel_fee(request):
        """Add a counsel fee to a financial record."""
        if err := auth.require_auth(request):
            return err
        financial_id = int(request.path_params["financial_id"])
        body = await request.json()
        result = await asyncio.to_thread(
            db.create_counsel_fee, financial_id, **body
        )
        broadcast({"entity": "financial", "action": "updated", "id": financial_id})
        return JSONResponse({"success": True, "financial": result})

    @mcp.custom_route("/api/v1/counsel-fees/{fee_id}", methods=["PUT"])
    async def api_update_counsel_fee(request):
        """Update a counsel fee."""
        if err := auth.require_auth(request):
            return err
        fee_id = int(request.path_params["fee_id"])
        body = await request.json()
        result = await asyncio.to_thread(db.update_counsel_fee, fee_id, **body)
        if not result:
            return api_error("Counsel fee not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "financial": result})

    @mcp.custom_route("/api/v1/counsel-fees/{fee_id}", methods=["DELETE"])
    async def api_delete_counsel_fee(request):
        """Delete a counsel fee."""
        if err := auth.require_auth(request):
            return err
        fee_id = int(request.path_params["fee_id"])
        result = await asyncio.to_thread(db.delete_counsel_fee, fee_id)
        if not result:
            return api_error("Counsel fee not found", "NOT_FOUND", 404)
        return JSONResponse({"success": True, "financial": result})
