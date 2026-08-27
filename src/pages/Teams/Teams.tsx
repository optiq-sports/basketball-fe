import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiSearch,
  FiFilter,
  FiChevronDown,
  FiMapPin,
  FiAward,
  FiEdit2,
  FiTrash,
} from "react-icons/fi";
import { GiBasketballBall } from "react-icons/gi";
import { MdCancel } from "react-icons/md";
import { Country, State } from "country-state-city";
import {
  useTeams,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
} from "../../api/hooks";
import type { Team as ApiTeam } from "../../types/api";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import { useToast } from "../../hooks/useToast";
import Pagination from "../../components/ui/Pagination";

const allCountries = Country.getAllCountries().sort((a, b) =>
  a.name.localeCompare(b.name),
);
const countryNameToIso = new Map(allCountries.map((c) => [c.name, c.isoCode]));

const Teams: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<ApiTeam | null>(null);
  const itemsPerPage = 9;

  const teamsQuery = useTeams();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();
  const { confirm, dialogProps } = useConfirmDialog();
  const toast = useToast();

  const teams = teamsQuery.data ?? [];

  // Filter teams by search query (client-side)
  const filteredTeams = useMemo(() => {
    let filtered = teams;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (team) =>
          team.name.toLowerCase().includes(query) ||
          (team.code && team.code.toLowerCase().includes(query)) ||
          (team.country && team.country.toLowerCase().includes(query)) ||
          (team.state && team.state.toLowerCase().includes(query)),
      );
    }
    return filtered;
  }, [searchQuery, teams]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredTeams.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTeams = filteredTeams.slice(startIndex, endIndex);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const [formData, setFormData] = useState({
    name: "",
    shortTeamCode: "",
    teamColor: "#21409A",
    country: "",
    state: "",
    coach: "",
    assistantCoach: "",
  });

  const handleTeamClick = (team: ApiTeam) => {
    navigate(`/teams-management/${team.id}`);
  };

  const handleAddTeam = () => {
    setEditingTeam(null);
    setFormData({
      name: "",
      shortTeamCode: "",
      teamColor: "#21409A",
      country: "",
      state: "",
      coach: "",
      assistantCoach: "",
    });
    setIsModalOpen(true);
  };

  const handleEditTeam = (team: ApiTeam, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTeam(team);
    setFormData({
      name: team.name,
      shortTeamCode: team.code ?? "",
      teamColor: team.color ?? "#21409A",
      country: team.country ?? "",
      state: team.state ?? "",
      coach: team.coach ?? "",
      assistantCoach: team.assistantCoach ?? "",
    });
    setIsModalOpen(true);
  };

  const handleDeleteTeam = async (team: ApiTeam, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      description: `Are you sure you want to delete ${team.name}? This action cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (ok) {
      deleteTeam.mutate(team.id, {
        onError: (err) => toast.error(err.message),
      });
    }
  };

  const handleSaveTeam = () => {
    if (!formData.name || !formData.shortTeamCode) {
      toast.error("Please fill in team name and code");
      return;
    }
    const payload = {
      name: formData.name,
      code: formData.shortTeamCode,
      color: formData.teamColor,
      country: formData.country || "USA",
      state: formData.state,
      coach: formData.coach || undefined,
      assistantCoach: formData.assistantCoach || undefined,
    };
    if (editingTeam) {
      updateTeam.mutate(
        { id: editingTeam.id, data: payload },
        {
          onSuccess: () => {
            setIsModalOpen(false);
            setEditingTeam(null);
            setFormData({
              name: "",
              shortTeamCode: "",
              teamColor: "#21409A",
              country: "",
              state: "",
              coach: "",
              assistantCoach: "",
            });
          },
          onError: (err) => toast.error(err.message),
        },
      );
    } else {
      createTeam.mutate(payload, {
        onSuccess: () => {
          setIsModalOpen(false);
          setFormData({
            name: "",
            shortTeamCode: "",
            teamColor: "#21409A",
            country: "",
            state: "",
            coach: "",
            assistantCoach: "",
          });
        },
        onError: (err) => toast.error(err.message),
      });
    }
  };

  return (
    <div className="min-h-screen bg-white p-8 dark:bg-gray-950">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
          Teams
        </h1>
      </div>

      {teamsQuery.error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-error-50 border border-error-100 text-error-700 text-sm dark:bg-error-500/10 dark:border-error-500/30 dark:text-error-500">
          {teamsQuery.error.message}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <button
          onClick={handleAddTeam}
          className="px-6 py-3 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 transition-colors whitespace-nowrap"
        >
          Add Team
        </button>
        <div className="relative" style={{ width: "250px", minWidth: "200px" }}>
          <FiSearch
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500"
            size={20}
          />
          <input
            type="text"
            placeholder="Search Team"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>
      </div>

      {teamsQuery.isPending ? (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">
          Loading teams...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {paginatedTeams.map((team) => {
              const teamColor = team.color ?? "#21409A";
              return (
                <div
                  key={team.id}
                  onClick={() => handleTeamClick(team)}
                  className="group cursor-pointer overflow-hidden rounded-2xl border border-gray-200 bg-white transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
                >
                  <div
                    className="relative h-24"
                    style={{
                      background: `linear-gradient(135deg, ${teamColor}, ${teamColor}99)`,
                    }}
                  >
                    <div className="absolute right-3 top-3 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={(e) => handleEditTeam(team, e)}
                        className="rounded-lg bg-white/90 p-1.5 text-gray-700 hover:bg-white"
                        title="Edit Team"
                      >
                        <FiEdit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteTeam(team, e)}
                        className="rounded-lg bg-white/90 p-1.5 text-error-600 hover:bg-white"
                        title="Delete Team"
                      >
                        <FiTrash size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <div className="-mt-8 flex size-16 items-center justify-center rounded-full border-4 border-white bg-white dark:border-gray-900 dark:bg-gray-900">
                      <div
                        className="flex size-full items-center justify-center rounded-full"
                        style={{ backgroundColor: teamColor }}
                      >
                        <GiBasketballBall className="text-2xl text-white" />
                      </div>
                    </div>
                  </div>
                  <div className="p-5 pt-3 text-center">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {team.name}
                    </h3>
                    <span className="mt-1 inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-white/5 dark:text-gray-400">
                      {team.code ?? "—"}
                    </span>
                    <div className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-left text-sm dark:border-gray-800">
                      {(team.coach || team.assistantCoach) && (
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <FiAward
                            size={14}
                            className="shrink-0 text-gray-400 dark:text-gray-500"
                          />
                          <span className="truncate">
                            {[team.coach, team.assistantCoach]
                              .filter(Boolean)
                              .join(" / ")}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <FiMapPin
                          size={14}
                          className="shrink-0 text-gray-400 dark:text-gray-500"
                        />
                        <span className="truncate">
                          {team.state && team.country
                            ? `${team.state}, ${team.country}`
                            : team.country || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {paginatedTeams.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                No teams found
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                Try adjusting your search or filter criteria
              </p>
            </div>
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredTeams.length}
            pageSize={itemsPerPage}
          />
        </>
      )}

      {/* Add/Edit Team Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-gray-900">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {editingTeam ? "Edit Team" : "Add Team"}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingTeam(null);
                  setFormData({
                    name: "",
                    shortTeamCode: "",
                    teamColor: "#21409A",
                    country: "",
                    state: "",
                    coach: "",
                    assistantCoach: "",
                  });
                }}
                className="text-gray-600 hover:text-gray-900 transition-colors dark:text-gray-400 dark:hover:text-white"
              >
                <MdCancel size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                    Team Name *
                  </label>
                  <input
                    type="text"
                    placeholder="Enter team name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                    Team Code *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., LAL"
                    value={formData.shortTeamCode}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        shortTeamCode: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    maxLength={10}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                    Team Color
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={formData.teamColor}
                      onChange={(e) =>
                        setFormData({ ...formData, teamColor: e.target.value })
                      }
                      className="w-20 h-10 border border-gray-300 rounded-lg cursor-pointer dark:border-gray-700"
                    />
                    <input
                      type="text"
                      value={formData.teamColor}
                      onChange={(e) =>
                        setFormData({ ...formData, teamColor: e.target.value })
                      }
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      placeholder="#21409A"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                    Country
                  </label>
                  <select
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        country: e.target.value,
                        state: "",
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="">Select country</option>
                    {allCountries.map((c) => (
                      <option key={c.isoCode} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                    State
                  </label>
                  <select
                    value={formData.state}
                    onChange={(e) =>
                      setFormData({ ...formData, state: e.target.value })
                    }
                    disabled={!formData.country}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:disabled:bg-white/5"
                  >
                    <option value="">Select state</option>
                    {formData.country &&
                      State.getStatesOfCountry(
                        countryNameToIso.get(formData.country) ?? "",
                      ).map((s) => (
                        <option key={s.isoCode} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                    Coach
                  </label>
                  <input
                    type="text"
                    placeholder="Coach name"
                    value={formData.coach}
                    onChange={(e) =>
                      setFormData({ ...formData, coach: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                    Assistant Coach
                  </label>
                  <input
                    type="text"
                    placeholder="Assistant coach name"
                    value={formData.assistantCoach}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        assistantCoach: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 p-6 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingTeam(null);
                  setFormData({
                    name: "",
                    shortTeamCode: "",
                    teamColor: "#21409A",
                    country: "",
                    state: "",
                    coach: "",
                    assistantCoach: "",
                  });
                }}
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTeam}
                disabled={createTeam.isPending || updateTeam.isPending}
                className="px-6 py-2.5 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 transition-colors disabled:opacity-70"
              >
                {createTeam.isPending || updateTeam.isPending
                  ? "Saving..."
                  : editingTeam
                    ? "Update"
                    : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
};

export default Teams;
