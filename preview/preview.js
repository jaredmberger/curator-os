import { mountCollectionCatalogShell, RecordService } from '../src/ui/collection-catalog-shell.js';

const seedRecords = [
  {
    id: 'ship.olympic',
    type: 'ship',
    title: 'RMS Olympic',
    summary: 'Lead ship of the Olympic class and a central reference record for the CuratorOS preview.',
    status: 'published',
    tags: ['White Star Line', 'Olympic class'],
    relationships: [{
      target: 'company.white-star-line',
      relationship: 'operated_by',
      confidence: 'verified',
      sourceIds: ['source.builder-records'],
      note: 'Documented in builder and company records.'
    }],
    sources: [{ id: 'source.builder-records', title: 'Builder records', type: 'archive' }],
    media: [],
    notes: [{ body: 'Developer preview seed record.', kind: 'curatorial' }],
    metadata: { confidence: 'verified', reviewed: '2026-07-25' }
  },
  {
    id: 'company.white-star-line',
    type: 'company',
    title: 'White Star Line',
    summary: 'British shipping company associated with the Olympic-class liners.',
    status: 'review',
    tags: ['Shipping line'],
    relationships: [],
    sources: [],
    media: [],
    notes: [],
    metadata: { confidence: 'probable' }
  },
  {
    id: 'source.builder-records',
    type: 'source',
    title: 'Builder records',
    summary: 'Primary shipbuilder documentation used for relationship provenance.',
    status: 'published',
    tags: ['Primary source'],
    relationships: [],
    sources: [],
    media: [],
    notes: [],
    metadata: { confidence: 'verified' }
  }
];

const root = document.querySelector('#curatoros-preview');
const recordService = new RecordService({ seedRecords });
mountCollectionCatalogShell(root, { recordService });
