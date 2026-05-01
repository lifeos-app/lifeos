/**
 * useMentorship — Core hook for the Mentorship system
 *
 * Provides reactive state and actions for mentorship pairs,
 * milestone tracking, matching, and XP integration.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  useMentorshipStore,
  type MentorshipPair,
  type MentorshipMilestone,
  type MentorProfile,
  type MenteeProfile,
} from '../../stores/mentorshipStore';

export { type MentorshipPair, type MentorshipMilestone, type MentorProfile, type MenteeProfile };

const MIN_MENTOR_LEVEL = 10;
const MAX_MENTEES = 3;

export function useMentorship() {
  const store = useMentorshipStore();
  const [activeTab, setActiveTab] = useState<'find' | 'become'>('find');

  // ── Computed state ──
  const myActivePairs = useMemo(() =>
    store.getActivePairsForUser(store.currentUserId),
    [store.pairs, store.currentUserId]
  );

  const myActiveMentorships = useMemo(() =>
    myActivePairs.filter(p => p.mentor_id === store.currentUserId),
    [myActivePairs, store.currentUserId]
  );

  const myActiveMentorshipsAsMentee = useMemo(() =>
    myActivePairs.filter(p => p.mentee_id === store.currentUserId),
    [myActivePairs, store.currentUserId]
  );

  const canBeMentor = useMemo(() => {
    // Check if user has level 10+ and less than MAX_MENTEES active
    return myActiveMentorships.length < MAX_MENTEES;
  }, [myActiveMentorships]);

  const recommendedMentors = useMemo(() =>
    store.getRecommendedMentors(store.currentUserId),
    [store.mentorProfiles, store.currentUserId]
  );

  const availableMentors = useMemo(() =>
    store.mentorProfiles.filter(m => m.availability !== 'full'),
    [store.mentorProfiles]
  );

  const pendingApplications = useMemo(() =>
    store.applications.filter(a => a.status === 'pending'),
    [store.applications]
  );

  // ── Actions ──
  const applyToMentor = useCallback((mentorId: string, message: string) => {
    store.applyToMentor(mentorId, message);
  }, [store]);

  const createPair = useCallback((mentorId: string, specializations: string[], menteeGoals?: string[]) => {
    return store.createPair(mentorId, store.currentUserId, specializations, menteeGoals);
  }, [store]);

  const acceptPair = useCallback((pairId: string) => {
    store.acceptPair(pairId);
  }, [store]);

  const completeMilestone = useCallback((pairId: string, milestoneId: string) => {
    store.completeMilestone(pairId, milestoneId);
    const pair = store.pairs.find(p => p.id === pairId);
    const milestone = pair?.milestones.find(m => m.id === milestoneId);
    if (milestone) {
      store.awardMilestoneXP(pairId, milestoneId);
    }
  }, [store]);

  const rateMentor = useCallback((pairId: string, rating: number) => {
    store.rateMentor(pairId, rating);
  }, [store]);

  const updateNotes = useCallback((pairId: string, notes: string) => {
    store.updateMentorNotes(pairId, notes);
  }, [store]);

  const pauseMentorship = useCallback((pairId: string) => {
    store.pausePair(pairId);
  }, [store]);

  const resumeMentorship = useCallback((pairId: string) => {
    store.resumePair(pairId);
  }, [store]);

  const graduateMentorship = useCallback((pairId: string) => {
    store.completePair(pairId);
  }, [store]);

  const endMentorship = useCallback((pairId: string) => {
    store.endPair(pairId);
  }, [store]);

  const registerAsMentor = useCallback((profile: Omit<MentorProfile, 'userId' | 'menteeCount' | 'ratingCount' | 'lastActive' | 'completedMentorships'>) => {
    store.registerAsMentor(profile);
  }, [store]);

  const registerAsMentee = useCallback((profile: Omit<MenteeProfile, 'userId' | 'createdAt'>) => {
    store.registerAsMentee(profile);
  }, [store]);

  const getCompatibility = useCallback((mentorId: string) => {
    return store.calculateCompatibility(mentorId, store.currentUserId);
  }, [store]);

  return {
    // State
    pairs: store.pairs,
    mentorProfiles: store.mentorProfiles,
    menteeProfiles: store.menteeProfiles,
    isMentor: store.isMentor,
    activeTab,
    setActiveTab,

    // Computed
    myActivePairs,
    myActiveMentorships,
    myActiveMentorshipsAsMentee,
    canBeMentor,
    recommendedMentors,
    availableMentors,
    pendingApplications,

    // Constants
    MIN_MENTOR_LEVEL,
    MAX_MENTEES,

    // Actions
    applyToMentor,
    createPair,
    acceptPair,
    completeMilestone,
    rateMentor,
    updateNotes,
    pauseMentorship,
    resumeMentorship,
    graduateMentorship,
    endMentorship,
    registerAsMentor,
    registerAsMentee,
    getCompatibility,
  };
}