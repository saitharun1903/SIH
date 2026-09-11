"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Resource, Building, ResourceType, PaginatedResponse } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import {
  Layers,
  Search,
  Plus,
  Edit2,
  Trash2,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ExternalLink,
  Users,
  Building2,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

export default function ResourcesPage() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole(["Administrator"]);

  // Data state
  const [resources, setResources] = useState<Resource[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [types, setTypes] = useState<ResourceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters state
  const [search, setSearch] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [capacity, setCapacity] = useState(60);
  const [buildingId, setBuildingId] = useState<number | undefined>(undefined);
  const [typeId, setTypeId] = useState<number>(1);
  const [floor, setFloor] = useState(1);
  const [area, setArea] = useState(800.0);
  const [statusVal, setStatusVal] = useState<"Active" | "Inactive" | "Maintenance">("Active");
  const [location, setLocation] = useState("Wing A");

  const fetchDependencies = async () => {
    try {
      const [bldgs, typeRes] = await Promise.all([
        api.getBuildingsList().catch(() => []),
        api.get<ResourceType[]>("/resource-types").catch(() => []),
      ]);
      setBuildings(Array.isArray(bldgs) ? bldgs : []);
      setTypes(Array.isArray(typeRes) ? typeRes : []);
      if (typeRes && typeRes.length > 0) setTypeId(typeRes[0].id);
      if (bldgs && bldgs.length > 0) setBuildingId(bldgs[0].id);
    } catch (e) {
      console.error("Failed to fetch dependencies", e);
    }
  };

  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: "15",
      });
      if (search) params.append("search", search);
      if (selectedBuilding) params.append("building_id", selectedBuilding);
      if (selectedType) params.append("resource_type_id", selectedType);
      if (selectedStatus) params.append("status", selectedStatus);

      const res = await api.get<PaginatedResponse<Resource>>(`/resources?${params.toString()}`);
      setResources(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      console.error("Failed to fetch resources", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedBuilding, selectedType, selectedStatus]);

  useEffect(() => {
    fetchDependencies();
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const handleOpenCreate = () => {
    setName("");
    setCode("");
    setCapacity(60);
    setFloor(1);
    setArea(800);
    setStatusVal("Active");
    setLocation("Wing A");
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (res: Resource, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingResource(res);
    setName(res.name);
    setCode(res.code);
    setCapacity(res.capacity);
    setBuildingId(res.building_id);
    setTypeId(res.resource_type_id);
    setFloor(res.floor);
    setArea(res.area);
    setStatusVal(res.status);
    setLocation(res.location);
    setFormError(null);
    setIsEditOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      await api.post("/resources", {
        name,
        code,
        capacity: Number(capacity),
        building_id: buildingId ? Number(buildingId) : null,
        resource_type_id: Number(typeId),
        floor: Number(floor),
        area: Number(area),
        status: statusVal,
        location,
      });
      setIsCreateOpen(false);
      fetchResources();
    } catch (err: any) {
      setFormError(err.message || "Failed to create resource.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingResource) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      await api.put(`/resources/${editingResource.id}`, {
        name,
        code,
        capacity: Number(capacity),
        building_id: buildingId ? Number(buildingId) : null,
        resource_type_id: Number(typeId),
        floor: Number(floor),
        area: Number(area),
        status: statusVal,
        location,
      });
      setIsEditOpen(false);
      fetchResources();
    } catch (err: any) {
      setFormError(err.message || "Failed to update resource.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, resCode: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete resource '${resCode}'?`)) return;
    try {
      await api.delete(`/resources/${id}`);
      fetchResources();
    } catch (err: any) {
      alert(err.message || "Failed to delete resource.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-blue">
              Infrastructure Inventory
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">Physical Institutional Assets</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-navy flex items-center gap-2.5">
            <Layers className="h-6 w-6 text-brand-blue" />
            Campus Spaces &amp; Resources
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Catalog of institutional lecture halls, computing laboratories, seminar rooms, and hardware ({total} recorded)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchResources}
            disabled={loading}
            className="flex items-center gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-brand-blue" : ""}`} />
            <span>Refresh</span>
          </Button>

          {isAdmin && (
            <Button variant="primary" size="sm" onClick={handleOpenCreate} className="flex items-center gap-1.5 font-bold">
              <Plus className="h-4 w-4" />
              <span>Add Resource</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 border-slate-200 bg-white shadow-subtle">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search code or name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-brand-navy placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
            />
          </div>

          {/* Building Filter */}
          <div className="relative">
            <select
              value={selectedBuilding}
              onChange={(e) => {
                setSelectedBuilding(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
            >
              <option value="">All Buildings</option>
              {Array.isArray(buildings) &&
                buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="relative">
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
            >
              <option value="">All Resource Types</option>
              {Array.isArray(types) &&
                types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Table Container */}
      <Card className="p-0 overflow-hidden border-slate-200 bg-white shadow-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Code / Name</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Building &amp; Floor</th>
                <th className="px-5 py-3 text-right">Capacity</th>
                <th className="px-5 py-3 text-right">Area (sq ft)</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    <div className="inline-block h-6 w-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mb-2" />
                    <div>Loading resources...</div>
                  </td>
                </tr>
              ) : resources.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    No campus resources match the selected criteria.
                  </td>
                </tr>
              ) : (
                resources.map((res) => (
                  <tr
                    key={res.id}
                    className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/resources/${res.id}`}
                        className="block font-bold text-brand-navy hover:text-brand-blue transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-sm">{res.code}</span>
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 text-brand-blue transition-opacity" />
                        </div>
                        <div className="text-[11px] font-normal text-slate-500">{res.name}</div>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant="neutral" size="sm">
                        {res.resource_type_name || "Space"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      <div className="font-medium text-brand-navy">{res.building_name || "Unassigned"}</div>
                      <div className="text-[10px] text-slate-400">Floor {res.floor} • {res.location || "Main"}</div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-mono font-bold text-brand-navy">{res.capacity}</span>
                      <span className="text-[10px] text-slate-400 ml-1">seats</span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-slate-600">
                      {res.area.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <Badge
                        variant={
                          res.status === "Active"
                            ? "success"
                            : res.status === "Maintenance"
                            ? "warning"
                            : "danger"
                        }
                        size="sm"
                      >
                        {res.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-1.5">
                      <Link
                        href={`/resources/${res.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-brand-blue bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                      >
                        <span>Inspect</span>
                      </Link>
                      {isAdmin && (
                        <>
                          <button
                            onClick={(e) => handleOpenEdit(res, e)}
                            className="p-1 rounded text-slate-400 hover:text-brand-blue hover:bg-slate-100 transition-colors"
                            title="Edit Resource"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(res.id, res.code, e)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete Resource"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-5 py-3.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-slate-50/50">
          <div>
            Showing Page <span className="text-brand-navy font-bold">{page}</span> of{" "}
            <span className="text-brand-navy font-bold">{totalPages}</span> ({total} institutional spaces)
          </div>
          <div className="flex items-center space-x-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-1.5 border-slate-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-1.5 border-slate-200"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Create / Edit Modals */}
      <Modal
        isOpen={isCreateOpen || isEditOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setIsEditOpen(false);
        }}
        title={isCreateOpen ? "Create Campus Resource" : `Edit Resource (${editingResource?.code})`}
        maxWidth="lg"
      >
        {formError && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={isCreateOpen ? handleCreateSubmit : handleEditSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Code (Identifier)</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. A-101"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-brand-navy focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Resource Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Advanced Lecture Hall A-101"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-brand-navy focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Building</label>
              <select
                value={buildingId || ""}
                onChange={(e) => setBuildingId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
              >
                <option value="">-- Unassigned --</option>
                {Array.isArray(buildings) &&
                  buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Resource Type</label>
              <select
                value={typeId}
                onChange={(e) => setTypeId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
              >
                {Array.isArray(types) &&
                  types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Capacity (Seats)</label>
              <input
                type="number"
                min="1"
                required
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-brand-navy focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Floor</label>
              <input
                type="number"
                required
                value={floor}
                onChange={(e) => setFloor(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-brand-navy focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Area (sq ft)</label>
              <input
                type="number"
                step="0.1"
                required
                value={area}
                onChange={(e) => setArea(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-brand-navy focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Status</label>
              <select
                value={statusVal}
                onChange={(e) => setStatusVal(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Wing / Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. North Wing"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-brand-navy focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false);
                setIsEditOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting} className="font-bold">
              {isSubmitting ? "Saving..." : isCreateOpen ? "Create Resource" : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
