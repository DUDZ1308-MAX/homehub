import { useState } from 'react';
import {
  Check,
  Download,
  ExternalLink,
  LogOut,
  MapPin,
  Search,
  Trash2,
} from 'lucide-react';
import type { Prefs } from '../types';
import { geocodePlace } from '../lib/homehub';
import { Modal } from './Modal';

type SettingsModalProps = {
  prefs: Prefs;
  clientId: string;
  googleConnected: boolean;
  googleStatus: string;
  wakeLockSupported: boolean;
  onClose: () => void;
  onSave: (prefs: Prefs, clientId: string) => void;
  onDisconnectGoogle: () => void;
  onExport: () => void;
  onReset: () => void;
};

export function SettingsModal({
  prefs,
  clientId,
  googleConnected,
  googleStatus,
  wakeLockSupported,
  onClose,
  onSave,
  onDisconnectGoogle,
  onExport,
  onReset,
}: SettingsModalProps) {
  const [draft, setDraft] = useState<Prefs>(() => ({
    ...prefs,
    manualLocation: prefs.manualLocation ? { ...prefs.manualLocation } : null,
  }));
  const [clientDraft, setClientDraft] = useState(clientId);
  const [locationQuery, setLocationQuery] = useState(
    prefs.manualLocation?.label ?? ''
  );
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupStatus, setLookupStatus] = useState('');
  const [error, setError] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);

  const update = (patch: Partial<Prefs>) =>
    setDraft(previous => ({ ...previous, ...patch }));

  const findLocation = async () => {
    if (!locationQuery.trim()) {
      setLookupStatus('Enter a city or town to search.');
      return;
    }
    setLookupBusy(true);
    setLookupStatus('');
    try {
      const place = await geocodePlace(locationQuery.trim());
      update({ manualLocation: place, useDeviceLocation: false });
      setLookupStatus(`Using ${place.label}`);
    } catch (lookupError) {
      setLookupStatus(
        lookupError instanceof Error
          ? lookupError.message
          : 'Location search failed. Try another place.'
      );
    } finally {
      setLookupBusy(false);
    }
  };

  const save = () => {
    if (!draft.useDeviceLocation && !draft.manualLocation) {
      setError(
        'Search for a place, or switch back to using your device location.'
      );
      return;
    }
    onSave(draft, clientDraft.trim());
  };

  return (
    <Modal
      eyebrow="PERSONALIZE HOMEHUB"
      title="Dashboard settings"
      onClose={onClose}
      className="settings-modal"
    >
      <section className="settings-section">
        <div className="settings-section-head">
          <strong>Display &amp; units</strong>
          <span>Saved on this device</span>
        </div>
        <div className="settings-grid">
          <label>
            Temperature
            <select
              value={draft.tempUnit}
              onChange={event =>
                update({ tempUnit: event.target.value as Prefs['tempUnit'] })
              }
              aria-label="Temperature unit"
            >
              <option value="c">Celsius (°C)</option>
              <option value="f">Fahrenheit (°F)</option>
            </select>
          </label>
          <label>
            Wind speed
            <select
              value={draft.windUnit}
              onChange={event =>
                update({ windUnit: event.target.value as Prefs['windUnit'] })
              }
              aria-label="Wind speed unit"
            >
              <option value="kmh">km/h</option>
              <option value="mph">mph</option>
            </select>
          </label>
          <label>
            Clock
            <select
              value={draft.clock24 ? '24' : '12'}
              onChange={event =>
                update({ clock24: event.target.value === '24' })
              }
              aria-label="Clock format"
            >
              <option value="12">12-hour</option>
              <option value="24">24-hour</option>
            </select>
          </label>
          <label>
            Week starts on
            <select
              value={String(draft.weekStartsOn)}
              onChange={event =>
                update({
                  weekStartsOn: Number(event.target.value) as Prefs['weekStartsOn'],
                })
              }
              aria-label="Week starts on"
            >
              <option value="0">Sunday</option>
              <option value="1">Monday</option>
            </select>
          </label>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={draft.keepAwake}
            onChange={event => update({ keepAwake: event.target.checked })}
            disabled={!wakeLockSupported}
            aria-label="Keep this screen awake"
          />
          <span>
            Keep this screen awake
            <small>
              {wakeLockSupported
                ? 'Useful for a wall-mounted tablet. The browser may release the lock when the tab is hidden.'
                : 'Screen Wake Lock is not supported by this browser.'}
            </small>
          </span>
        </label>
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <strong>Weather location</strong>
          <span>Used for the local forecast</span>
        </div>
        <div className="location-options">
          <label className="radio-row">
            <input
              type="radio"
              name="weather-location"
              checked={draft.useDeviceLocation}
              onChange={() => update({ useDeviceLocation: true })}
              aria-label="Use this device's location"
            />
            <span>
              <MapPin size={14} /> Use this device's location
            </span>
          </label>
          <label className="radio-row">
            <input
              type="radio"
              name="weather-location"
              checked={!draft.useDeviceLocation}
              onChange={() => update({ useDeviceLocation: false })}
              aria-label="Use a saved place"
            />
            <span>Use a saved place</span>
          </label>
        </div>
        {!draft.useDeviceLocation && (
          <div className="location-search">
            <input
              value={locationQuery}
              onChange={event => setLocationQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void findLocation();
                }
              }}
              placeholder="Search a city or town"
              aria-label="Search for a weather location"
            />
            <button
              type="button"
              className="secondary-button"
              onClick={() => void findLocation()}
              disabled={lookupBusy}
            >
              <Search size={14} /> {lookupBusy ? 'Searching…' : 'Find'}
            </button>
          </div>
        )}
        {(lookupStatus || draft.manualLocation) && (
          <p className="settings-hint">
            {lookupStatus ||
              (draft.manualLocation
                ? `Saved place: ${draft.manualLocation.label}`
                : '')}
          </p>
        )}
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <strong>Google Calendar</strong>
          <span>{googleConnected ? 'Connected' : 'Not connected'}</span>
        </div>
        <label>
          Google OAuth Client ID
          <input
            value={clientDraft}
            onChange={event => setClientDraft(event.target.value)}
            placeholder="xxxx.apps.googleusercontent.com"
            aria-label="Google OAuth Client ID"
          />
        </label>
        <div className="setup-help">
          <strong>Connect Google Calendar</strong>
          <ol>
            <li>
              Open the{' '}
              <a
                href="https://console.cloud.google.com/"
                target="_blank"
                rel="noreferrer"
              >
                Google Cloud Console <ExternalLink size={11} />
              </a>
              .
            </li>
            <li>Create a project and enable the Google Calendar API.</li>
            <li>
              Configure the OAuth consent screen and create an OAuth Client ID
              for a Web application.
            </li>
            <li>
              Add this dashboard's deployed website origin to Authorized
              JavaScript origins.
            </li>
            <li>
              Paste the Client ID above, save, then choose Sync calendar.
            </li>
          </ol>
          <p>
            {googleStatus}. HomeHub requests read-only calendar access. The
            token stays in this browser session; calendar events are displayed
            locally.
          </p>
        </div>
        {googleConnected && (
          <button
            type="button"
            className="secondary-button danger-text"
            onClick={onDisconnectGoogle}
          >
            <LogOut size={14} /> Disconnect Google &amp; remove synced events
          </button>
        )}
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <strong>Your data</strong>
          <span>Stored locally in this browser</span>
        </div>
        <div className="settings-actions">
          <button type="button" className="secondary-button" onClick={onExport}>
            <Download size={14} /> Export a backup
          </button>
          <button
            type="button"
            className="secondary-button danger-text"
            onClick={() => {
              if (!resetConfirm) {
                setResetConfirm(true);
                return;
              }
              onReset();
            }}
          >
            <Trash2 size={14} />{' '}
            {resetConfirm ? 'Confirm reset' : 'Reset local data'}
          </button>
        </div>
        <p className="settings-hint">
          Only events, tasks, notes and preferences are stored in this browser.
          Google Calendar passwords are never stored.
        </p>
      </section>

      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="primary-button compact" onClick={save}>
          <Check size={14} /> Save settings
        </button>
      </div>
    </Modal>
  );
}
