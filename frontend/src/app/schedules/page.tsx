"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Schedule, Resource, PaginatedResponse } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  CalendarDays,
  Search,
  Plus,
  Trash2,
  Clock,
  MapPin,
  Users,
  AlertCircle,
  BookOpen,
  LayoutGrid,
  List,
  ExternalLink,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import clsx from "clsx";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function SchedulesPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole(["Administrator", "Analyst"]);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>("Monday");
  const [search, setSearch] = useState("");
  const [selectedResource, setSelectedResource] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [resourceId, setResourceId] = useState<number>(1);
  const [subjectName, setSubjectName] = useState("");
  const [department, setDepartment] = useState("Computer Science");
  const [dayOfWeek, setDayOfWeek] = useState("Monday");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [expectedOccupancy, setExpectedOccupancy] = useState(50);

  const fetchResources = async () => {
    try {
      const items = await api.getResourcesList();
      setResources(Array.isArray(items) ? items : []);
      if (items.length > 0 && !resourceId) setResourceId(items[0].id);
    } catch (e) {
      console.error("Failed to fetch resources for schedule", e);
    }
  };

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getSchedules({
        day_of_week: selectedDay,
        resource_id: selectedResource ? parseInt(selectedResource) : undefined,
        page_size: 100,
      });
      setSchedules(Array.isArray(res?.items) ? res.items : []);
      setTotal(res?.total || 0);
    } catch (e) {
      console.error("Failed to load schedules", e);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDay, search, selectedResource]);

  useEffect(() => {
    fetchResources();
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Derived metrics for selected day
  const dayStats = useMemo(() => {
    const classCount = schedules.length;
    const totalFootfall = schedules.reduce((acc, s) => acc + (s.expected_occupancy || 0), 0);
    const uniqueRooms = new Set(schedules.map((s) => s.resource_id)).size;

    // Calculate peak hour
    const hourCounts: Record<string, number> = {};
    schedules.forEach((s) => {
      const startH = s.start_time ? s.start_time.split(":")[0] : "09";
      hourCounts[startH] = (hourCounts[startH] || 0) + 1;
    });
    let peakHour = "09:00";
    let maxCount = 0;
    Object.entries(hourCounts).forEach(([h, count]) => {
      if (count > maxCount) {
        maxCount = count;
        peakHour = `${h}:00`;
      }
    });

    return { classCount, totalFootfall, uniqueRooms, peakHour };
  }, [schedules]);

  const handleOpenCreate = () => {
    setSubjectName("");
    setDepartment("Computer Science");
    setDayOfWeek(selectedDay);
    setStartTime("09:00");
    setEndTime("10:00");
    setExpectedOccupancy(50);
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      await api.post("/schedules", {
        resource_id: Number(resourceId),
        subject_name: subjectName.trim(),
        department: department.trim(),
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        expected_occupancy: Number(expectedOccupancy),
      });
      setIsCreateOpen(false);
      fetchSchedules();
    } catch (err: any) {
      setFormError(err.message || "Failed to schedule class. Check for timetable conflicts.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, subj: string) => {
    if (!confirm(`Are you sure you want to cancel and delete the scheduled class '${subj}'?`)) return;
    try {
      await api.delete(`/schedules/${id}`);
      fetchSchedules();
    } catch (err: any) {
      alert(err.message || "Failed to delete schedule.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#092634] flex items-center gap-2.5">
            <CalendarDays className="h-6 w-6 text-[#004E72]" />
            Academic Timetable & Allocations
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Weekly departmental course sessions, room occupancies, and operational timetable tracking
          </p>
        </div>

        {canManage && (
          <Button
            variant="primary"
            size="md"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 bg-[#004E72] hover:bg-[#003d59] text-white shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Add Class Schedule</span>
          </Button>
        )}
      </div>

      {/* Day Selector Tabs */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center space-x-1 overflow-x-auto">
          {DAYS.map((day) => {
            const isSelected = selectedDay === day;
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={clsx(
                  "px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                  isSelected
                    ? "bg-[#004E72] text-white shadow-sm"
                    : "text-slate-600 hover:text-[#092634] hover:bg-slate-100"
                )}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* View Mode Toggle */}
        <div className="hidden sm:flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setViewMode("grid")}
            className={clsx(
              "px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all",
              viewMode === "grid"
                ? "bg-white text-[#004E72] shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            )}
            title="Card Grid View"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Cards</span>
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={clsx(
              "px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all",
              viewMode === "table"
                ? "bg-white text-[#004E72] shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            )}
            title="Structured Table View"
          >
            <List className="h-3.5 w-3.5" />
            <span>Table</span>
          </button>
        </div>
      </div>

      {/* Selected Day KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-subtle p-5">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{selectedDay} Classes</div>
          <div className="text-2xl font-bold text-[#092634] mt-1">{dayStats.classCount}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-[#004E72]" />
            Active timetable slots
          </div>
        </Card>

        <Card className="bg-white border-slate-200 shadow-subtle p-5">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Expected Footfall</div>
          <div className="text-2xl font-bold text-[#004E72] mt-1">{dayStats.totalFootfall}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-[#004E72]" />
            Enrolled student attendance
          </div>
        </Card>

        <Card className="bg-white border-slate-200 shadow-subtle p-5">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Venues Utilized</div>
          <div className="text-2xl font-bold text-[#092634] mt-1">{dayStats.uniqueRooms}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-emerald-600" />
            Rooms & laboratories
          </div>
        </Card>

        <Card className="bg-white border-slate-200 shadow-subtle p-5">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Peak Schedule Hour</div>
          <div className="text-2xl font-bold text-[#FF6E42] mt-1">{dayStats.peakHour}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-[#FF6E42]" />
            Highest concurrent sessions
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="bg-white border-slate-200 shadow-subtle p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by course name or academic department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-[#092634] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#004E72] focus:border-transparent transition-all"
            />
          </div>

          <select
            value={selectedResource}
            onChange={(e) => setSelectedResource(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-[#092634] focus:outline-none focus:ring-2 focus:ring-[#004E72] focus:border-transparent transition-all"
          >
            <option value="">All Rooms, Auditoriums & Labs</option>
            {Array.isArray(resources) &&
              resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} — {r.name} (Cap: {r.capacity})
                </option>
              ))}
          </select>
        </div>
      </Card>

      {/* Content Rendering (Grid or Table) */}
      {loading ? (
        <Card className="bg-white border-slate-200 shadow-subtle p-12 text-center text-slate-500">
          <div className="inline-block h-6 w-6 border-2 border-[#004E72] border-t-transparent rounded-full animate-spin mb-3" />
          <div className="text-xs font-medium text-slate-600">Retrieving academic timetable...</div>
        </Card>
      ) : schedules.length === 0 ? (
        <Card className="bg-white border-slate-200 shadow-subtle p-12 text-center text-slate-500">
          <CalendarDays className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#092634]">No class sessions scheduled</p>
          <p className="text-xs text-slate-400 mt-1">
            No academic sessions found for {selectedDay} matching the active filters.
          </p>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schedules.map((sched) => (
            <Card
              key={sched.id}
              className="bg-white border-slate-200 hover:border-[#004E72]/40 hover:shadow-md transition-all shadow-subtle p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <span className="px-2.5 py-1 rounded bg-[#004E72]/10 text-[#004E72] font-mono text-xs font-bold border border-[#004E72]/20">
                    {sched.start_time} - {sched.end_time}
                  </span>
                  {canManage && (
                    <button
                      onClick={() => handleDelete(sched.id, sched.subject_name)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition-colors"
                      title="Cancel / Delete Schedule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="mt-3">
                  <h4 className="text-sm font-bold text-[#092634] leading-snug">{sched.subject_name}</h4>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                    <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                    <span>{sched.department}</span>
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <Link
                  href={`/resources/${sched.resource_id}`}
                  className="flex items-center gap-1 font-semibold text-[#004E72] hover:text-[#092634] transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5 text-[#004E72]" />
                  <span>{sched.resource_code || `Room #${sched.resource_id}`}</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
                <span className="flex items-center gap-1 text-slate-600 font-medium">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  <span>{sched.expected_occupancy} students</span>
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* Structured Table View */
        <Card className="bg-white border-slate-200 shadow-subtle overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Time Window</th>
                  <th className="py-3 px-4">Course / Subject</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Allocated Venue</th>
                  <th className="py-3 px-4 text-right">Expected Students</th>
                  {canManage && <th className="py-3 px-4 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedules.map((sched) => (
                  <tr key={sched.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#004E72]">
                      {sched.start_time} - {sched.end_time}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#092634]">{sched.subject_name}</td>
                    <td className="py-3 px-4 text-slate-600">{sched.department}</td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/resources/${sched.resource_id}`}
                        className="inline-flex items-center gap-1 font-semibold text-[#004E72] hover:underline"
                      >
                        <MapPin className="h-3 w-3" />
                        <span>{sched.resource_code || `Room #${sched.resource_id}`}</span>
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700">
                      {sched.expected_occupancy}
                    </td>
                    {canManage && (
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDelete(sched.id, sched.subject_name)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition-colors"
                          title="Delete Schedule"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal for Scheduling Class */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Schedule Academic Class Session"
      >
        {formError && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Target Space / Facility</label>
            <select
              value={resourceId}
              onChange={(e) => setResourceId(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-[#092634] outline-none focus:ring-2 focus:ring-[#004E72] focus:border-transparent transition-all"
            >
              {Array.isArray(resources) &&
                resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.name} (Capacity: {r.capacity})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Course / Subject Name</label>
            <input
              type="text"
              required
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="e.g. CS401: Distributed Operating Systems"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-[#092634] outline-none focus:ring-2 focus:ring-[#004E72] focus:border-transparent transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Department</label>
              <input
                type="text"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Computer Science"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-[#092634] outline-none focus:ring-2 focus:ring-[#004E72] focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Day of Week</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-[#092634] outline-none focus:ring-2 focus:ring-[#004E72] focus:border-transparent transition-all"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Start Time</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-[#092634] outline-none focus:ring-2 focus:ring-[#004E72] focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">End Time</label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-[#092634] outline-none focus:ring-2 focus:ring-[#004E72] focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Expected Student Occupancy</label>
            <input
              type="number"
              min={1}
              max={500}
              value={expectedOccupancy}
              onChange={(e) => setExpectedOccupancy(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-[#092634] outline-none focus:ring-2 focus:ring-[#004E72] focus:border-transparent transition-all"
            />
          </div>

          <div className="pt-4 flex justify-end space-x-2 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
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
              Confirm Schedule
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
