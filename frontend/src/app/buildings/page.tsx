"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Building, PaginatedResponse } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CardSkeleton } from "@/components/common/SectionSkeleton";
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Layers,
  MapPin,
  AlertCircle,
  Search,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";

export default function BuildingsPage() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole(["Administrator"]);

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [location, setLocation] = useState("Main Campus");
  const [floorCount, setFloorCount] = useState(4);

  const fetchBuildings = useCallback(async () => {
    setLoading(true);
    try {
      const items = await api.getBuildingsList({ search });
      setBuildings(Array.isArray(items) ? items : []);
    } catch (e) {
      console.error("Failed to load buildings", e);
      setBuildings([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);

  // Derived metrics
  const stats = useMemo(() => {
    const totalBlocks = buildings.length;
    const totalFloors = buildings.reduce((acc, b) => acc + (b.floor_count || 0), 0);
    const totalSpaces = buildings.reduce((acc, b) => acc + (b.resource_count || 0), 0);
    const uniqueLocations = new Set(buildings.map((b) => b.location).filter(Boolean)).size;
    return { totalBlocks, totalFloors, totalSpaces, uniqueLocations };
  }, [buildings]);

  const handleOpenCreate = () => {
    setName("");
    setCode("");
    setLocation("Main Campus");
    setFloorCount(4);
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (b: Building) => {
    setEditingBuilding(b);
    setName(b.name);
    setCode(b.code);
    setLocation(b.location);
    setFloorCount(b.floor_count);
    setFormError(null);
    setIsEditOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      await api.post("/buildings", {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        location: location.trim(),
        floor_count: Number(floorCount),
      });
      setIsCreateOpen(false);
      fetchBuildings();
    } catch (err: any) {
      setFormError(err.message || "Failed to create building block.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBuilding) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      await api.put(`/buildings/${editingBuilding.id}`, {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        location: location.trim(),
        floor_count: Number(floorCount),
      });
      setIsEditOpen(false);
      fetchBuildings();
    } catch (err: any) {
      setFormError(err.message || "Failed to update building block.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, code: string) => {
    if (!confirm(`Are you sure you want to delete building '${code}'? All associated spaces will be unlinked.`)) return;
    try {
      await api.delete(`/buildings/${id}`);
      fetchBuildings();
    } catch (err: any) {
      alert(err.message || "Failed to delete building.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#092634] flex items-center gap-2.5">
            <Building2 className="h-6 w-6 text-[#004E72]" />
            Campus Physical Infrastructure
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Institutional buildings, departmental blocks, floor distributions, and spatial capacity hierarchy
          </p>
        </div>

        {isAdmin && (
          <Button
            variant="primary"
            size="md"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 bg-[#004E72] hover:bg-[#003d59] text-white shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Add Building Block</span>
          </Button>
        )}
      </div>

      {/* Institutional KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-subtle p-5">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Campus Blocks</div>
          <div className="text-2xl font-bold text-[#092634] mt-1">{stats.totalBlocks}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5 text-[#004E72]" />
            Registered physical complexes
          </div>
        </Card>

        <Card className="bg-white border-slate-200 shadow-subtle p-5">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Managed Floors</div>
          <div className="text-2xl font-bold text-[#004E72] mt-1">{stats.totalFloors}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <Layers className="h-3.5 w-3.5 text-[#004E72]" />
            Active vertical levels
          </div>
        </Card>

        <Card className="bg-white border-slate-200 shadow-subtle p-5">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Associated Spaces</div>
          <div className="text-2xl font-bold text-[#092634] mt-1">{stats.totalSpaces}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Rooms, labs & auditoriums
          </div>
        </Card>

        <Card className="bg-white border-slate-200 shadow-subtle p-5">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Campus Zones</div>
          <div className="text-2xl font-bold text-[#FF6E42] mt-1">{stats.uniqueLocations}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-[#FF6E42]" />
            Geographical quadrants
          </div>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card className="bg-white border-slate-200 shadow-subtle p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by building name, block code, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs text-[#092634] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#004E72] focus:border-transparent transition-all"
            />
          </div>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
            >
              Clear
            </button>
          )}
        </div>
      </Card>

      {/* Buildings Cards Grid */}
      {loading && buildings.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <CardSkeleton count={6} className="h-44" />
        </div>
      ) : buildings.length === 0 ? (
        <Card className="bg-white border-slate-200 p-12 text-center text-slate-500 shadow-subtle">
          <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#092634]">No building blocks found</p>
          <p className="text-xs text-slate-400 mt-1">
            {search ? "Try adjusting your search criteria" : "Register a building block to begin spatial tracking"}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.isArray(buildings) &&
            buildings.map((bldg) => (
              <Card
              key={bldg.id}
              className="bg-white border-slate-200 hover:border-[#004E72]/40 hover:shadow-md transition-all shadow-subtle p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-xl bg-[#004E72]/10 border border-[#004E72]/20 flex items-center justify-center text-[#004E72]">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-[#004E72] border border-slate-200">
                      {bldg.code}
                    </span>
                    {isAdmin && (
                      <div className="flex items-center space-x-0.5 ml-2">
                        <button
                          onClick={() => handleOpenEdit(bldg)}
                          className="p-1 rounded text-slate-400 hover:text-[#004E72] hover:bg-slate-100 transition-colors"
                          title="Edit Building"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(bldg.id, bldg.code)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                          title="Delete Building"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3.5">
                  <h3 className="text-base font-bold text-[#092634] leading-snug">{bldg.name}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                    <span>{bldg.location || "Main Campus"}</span>
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">{bldg.floor_count} Floors</span>
                <Link
                  href={`/resources?building_id=${bldg.id}`}
                  className="flex items-center gap-1.5 text-[#004E72] hover:text-[#092634] font-semibold transition-colors"
                >
                  <Layers className="h-3.5 w-3.5 text-[#004E72]" />
                  <span>{bldg.resource_count || 0} Managed Spaces</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal for Add / Edit */}
      <Modal
        isOpen={isCreateOpen || isEditOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setIsEditOpen(false);
        }}
        title={isCreateOpen ? "Add Campus Building Block" : `Edit Building Block (${editingBuilding?.code})`}
      >
        {formError && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={isCreateOpen ? handleCreateSubmit : handleEditSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Building Code</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. BLOCK-E"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-[#092634] outline-none focus:ring-2 focus:ring-[#004E72] focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Building Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Innovation Complex"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-[#092634] outline-none focus:ring-2 focus:ring-[#004E72] focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Campus Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. East Campus Quad"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-[#092634] outline-none focus:ring-2 focus:ring-[#004E72] focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Total Floor Levels</label>
            <input
              type="number"
              min={1}
              max={50}
              value={floorCount}
              onChange={(e) => setFloorCount(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-[#092634] outline-none focus:ring-2 focus:ring-[#004E72] focus:border-transparent transition-all"
            />
          </div>

          <div className="pt-4 flex justify-end space-x-2 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsCreateOpen(false);
                setIsEditOpen(false);
              }}
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              className="bg-[#004E72] hover:bg-[#003d59] text-white"
            >
              {isCreateOpen ? "Create Building" : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
