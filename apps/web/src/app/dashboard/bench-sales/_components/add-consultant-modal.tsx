'use client';

import { useState, useRef } from 'react';
import {
  XMarkIcon,
  CloudArrowUpIcon,
  DocumentTextIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { api, ApiError } from '@/lib/api';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const VISA_OPTIONS = [
  { value: '', label: 'Select visa type...' },
  { value: 'USC', label: 'US Citizen' },
  { value: 'GC', label: 'Green Card' },
  { value: 'H1B', label: 'H-1B' },
  { value: 'L1', label: 'L-1' },
  { value: 'OPT', label: 'OPT' },
  { value: 'CPT', label: 'CPT' },
  { value: 'EAD', label: 'EAD' },
  { value: 'TN', label: 'TN' },
];

const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AddConsultantModal({ onClose, onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [skills, setSkills] = useState('');
  const [visaType, setVisaType] = useState('');
  const [desiredRate, setDesiredRate] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = (e.target as HTMLInputElement).files?.[0];
    if (!selected) return;
    if (selected.size > MAX_FILE_SIZE) {
      setError('File size must be under 10MB');
      return;
    }
    setFile(selected);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('First name, last name, and email are required');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('firstName', firstName.trim());
      formData.append('lastName', lastName.trim());
      formData.append('email', email.trim());
      if (phone.trim()) formData.append('phone', phone.trim());
      if (skills.trim()) {
        const skillArray = skills.split(',').map((s) => s.trim()).filter(Boolean);
        formData.append('skills', JSON.stringify(skillArray));
      }
      if (visaType) formData.append('visaType', visaType);
      if (desiredRate) formData.append('desiredRate', desiredRate);
      if (availableFrom) formData.append('availableFrom', availableFrom);
      if (file) formData.append('resume', file);

      const token = (await import('@/lib/auth')).useAuthStore.getState().token;
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

      const res = await fetch(`${API_BASE}/bench-intake/add-consultant`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || `Failed (${res.status})`);
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add consultant');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Add Consultant to Bench</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName((e.target as HTMLInputElement).value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName((e.target as HTMLInputElement).value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Doe"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="john.doe@example.com"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone((e.target as HTMLInputElement).value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="+1 (555) 123-4567"
            />
          </div>

          {/* Skills */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Skills <span className="text-xs text-gray-400">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={skills}
              onChange={(e) => setSkills((e.target as HTMLInputElement).value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Python, AWS, React, Kubernetes..."
            />
          </div>

          {/* Visa + Rate row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Visa Type</label>
              <select
                value={visaType}
                onChange={(e) => setVisaType((e.target as HTMLSelectElement).value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {VISA_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Desired Rate <span className="text-xs text-gray-400">($/hr)</span>
              </label>
              <input
                type="number"
                value={desiredRate}
                onChange={(e) => setDesiredRate((e.target as HTMLInputElement).value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="75"
                min="0"
              />
            </div>
          </div>

          {/* Available From */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Available From</label>
            <input
              type="date"
              value={availableFrom}
              onChange={(e) => setAvailableFrom((e.target as HTMLInputElement).value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Resume Upload */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Resume Upload <span className="text-xs text-gray-400">(PDF, DOC, DOCX — max 10MB)</span>
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition ${
                file
                  ? 'border-indigo-300 bg-indigo-50'
                  : 'border-gray-300 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/50'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                onChange={handleFileChange}
                className="hidden"
              />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <DocumentTextIcon className="h-6 w-6 text-indigo-500" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (fileRef.current) fileRef.current.value = '';
                    }}
                    className="ml-2 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <CloudArrowUpIcon className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="mt-1 text-sm text-gray-600">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-400">PDF, DOC, DOCX up to 10MB</p>
                </>
              )}
            </div>
          </div>

          {/* Info note */}
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-4 py-3">
            <p className="text-xs text-indigo-700">
              After adding the consultant, our AI pipeline will automatically process:
              Resume Parsing → Resume Prep → Tech Prep → Coaching → LinkedIn Prep → Sales Strategy → Job Search → GM Assessment
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
            {submitting ? 'Adding...' : 'Add & Start AI Pipeline'}
          </button>
        </div>
      </div>
    </div>
  );
}
