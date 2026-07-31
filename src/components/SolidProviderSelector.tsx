import { useState } from 'react';
import { Modal } from './Modal';

export interface SolidProvider {
  name: string;
  issuer: string;
  description?: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export const COMMON_PROVIDERS: SolidProvider[] = [
  {
    name: 'Inrupt PodSpaces',
    issuer: 'https://login.inrupt.com',
    description: 'Free · run by Inrupt (founded by Tim Berners-Lee, inventor of the Web)'
  },
  {
    name: 'solidcommunity.net',
    issuer: 'https://solidcommunity.net',
    description: 'Free · community-run, backed by the Open Data Institute'
  },
  {
    name: 'Private Data Pod',
    issuer: 'https://privatedatapod.com',
    description: 'Free · 1 GB storage · beginner-friendly'
  }
];

export const LAST_PROVIDER_KEY = 'solid-last-provider-issuer';

const DEFAULT_PROVIDER = COMMON_PROVIDERS.find(p => p.issuer === 'https://login.inrupt.com')!;

function getLastUsedProvider(): SolidProvider | null {
  const issuer = localStorage.getItem(LAST_PROVIDER_KEY);
  if (!issuer) return null;
  return COMMON_PROVIDERS.find(p => p.issuer === issuer) ?? null;
}

interface SolidProviderSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (issuer: string) => void;
}

export function SolidProviderSelector({ isOpen, onClose, onSelect }: SolidProviderSelectorProps) {
  const primaryProvider = getLastUsedProvider() ?? DEFAULT_PROVIDER;
  const sortedProviders = [primaryProvider, ...COMMON_PROVIDERS.filter(p => p.issuer !== primaryProvider.issuer)];

  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();
  const matchingProviders = normalizedQuery
    ? sortedProviders.filter(p => p.name.toLowerCase().includes(normalizedQuery) || p.issuer.toLowerCase().includes(normalizedQuery))
    : sortedProviders;

  const handleProviderSelect = (issuer: string) => {
    localStorage.setItem(LAST_PROVIDER_KEY, issuer);
    onSelect(issuer);
    onClose();
    setQuery('');
  };

  const handleCustomSubmit = () => {
    if (query.trim()) {
      handleProviderSelect(query.trim());
    }
  };

  const handleClose = () => {
    onClose();
    setQuery('');
  };

  const isLastUsed = localStorage.getItem(LAST_PROVIDER_KEY) === primaryProvider.issuer;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Login with Your Solid Pod">
      <div className="space-y-4">
        {/* Explanation section */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 space-y-2">
          <h3 className="font-semibold text-gray-900 text-sm">What is a Solid Pod?</h3>
          <p className="text-sm text-gray-700">
            A Solid Pod is your personal data storage that <strong>you control</strong>. Instead of storing your packing lists on our servers, they're stored in your own secure space.
          </p>
          <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
            <li><strong>You own your data</strong> - it stays in your Pod</li>
            <li><strong>Privacy-focused</strong> - you choose who can access it</li>
            <li><strong>Portable</strong> - use your Pod with any Solid app</li>
          </ul>
        </div>

        <div className="border-t border-gray-200 pt-4 space-y-3">
          <label className="block">
            <span className="text-sm text-gray-600">
              {isLastUsed && !query ? 'Continue with your last-used provider, search for another, or paste a Pod URL:' : 'Search providers or paste a Pod URL:'}
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (matchingProviders.length > 0) handleProviderSelect(matchingProviders[0].issuer);
                else handleCustomSubmit();
              }}
              placeholder="Search providers or paste a Pod URL…"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </label>

          <div className="space-y-2">
            {matchingProviders.map((provider) => (
              <button
                key={provider.issuer}
                aria-label={provider.name}
                onClick={() => handleProviderSelect(provider.issuer)}
                className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
                  provider.issuer === primaryProvider.issuer
                    ? 'border-2 border-blue-400 bg-blue-50 hover:bg-blue-100 hover:border-blue-500'
                    : 'border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                }`}
              >
                <div className="font-medium text-gray-900">{provider.name}</div>
                {provider.description && (
                  <div className="text-xs text-green-700 font-medium">{provider.description}</div>
                )}
                <div className="text-xs text-gray-400">{provider.issuer}</div>
              </button>
            ))}

            {query.trim() && matchingProviders.length === 0 && (
              <p className="text-sm text-gray-500 px-1">No matching providers.</p>
            )}

            {query.trim() && (
              <button
                type="button"
                onClick={handleCustomSubmit}
                className="w-full text-left px-4 py-3 border border-dashed border-gray-300 hover:bg-gray-50 hover:border-gray-400 rounded-md transition-colors"
              >
                <div className="font-medium text-gray-900">Connect to custom provider</div>
                <div className="text-xs text-gray-400 truncate">{query.trim()}</div>
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
