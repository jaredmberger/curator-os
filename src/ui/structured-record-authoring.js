export class StructuredRecordAuthoringService {
  constructor(recordService) {
    if (!recordService) throw new Error('RecordService is required.');
    this.recordService = recordService;
  }

  createRecord(input = {}) {
    const record = CuratorDatabase.createRecord({
      id: input.id,
      type: input.type,
      title: input.title,
      status: input.status || 'draft',
      summary: input.summary || '',
      tags: input.tags || [],
      relationships: input.relationships || [],
      sources: input.sources || [],
      media: input.media || [],
      notes: input.notes || [],
      data: input.data || {},
      metadata: {
        confidence: input.metadata?.confidence || 'unknown',
        reviewed: input.metadata?.reviewed || null
      }
    });
    return this.recordService.create(record);
  }

  updateRelationships(id, relationships = []) {
    const normalized = relationships.map((relationship) => CuratorRelationships.create(relationship));
    return this.recordService.update(id, { relationships: normalized });
  }

  updateSources(id, sources = []) {
    const normalized = sources.map((source) => normalizeSource(source));
    return this.recordService.update(id, { sources: normalized });
  }

  updateMedia(id, media = []) {
    return this.recordService.update(id, { media: media.map(normalizeMedia) });
  }

  updateNotes(id, notes = []) {
    return this.recordService.update(id, { notes: notes.map(normalizeNote) });
  }

  removeRecord(id, options = {}) {
    const incoming = this.recordService.incoming(id);
    if (incoming.length && !options.force) {
      throw new Error(`Cannot remove ${id}; ${incoming.length} incoming relationship${incoming.length === 1 ? '' : 's'} remain.`);
    }
    return this.recordService.remove(id);
  }
}

export function parseStructuredList(value = '', mapper = (item) => item) {
  return String(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => mapper(JSON.parse(line)));
}

export function stringifyStructuredList(values = []) {
  return values.map((value) => JSON.stringify(value)).join('\n');
}

function normalizeSource(source = {}) {
  const id = text(source.id);
  const title = text(source.title || source.label);
  if (!id) throw new Error('Source id is required.');
  if (!title) throw new Error('Source title is required.');
  return {
    id,
    title,
    type: text(source.type),
    date: text(source.date),
    url: text(source.url),
    note: text(source.note)
  };
}

function normalizeMedia(media = {}) {
  const id = text(media.id);
  const title = text(media.title || media.label);
  if (!id) throw new Error('Media id is required.');
  if (!title) throw new Error('Media title is required.');
  return {
    id,
    title,
    type: text(media.type),
    url: text(media.url),
    alt: text(media.alt),
    note: text(media.note)
  };
}

function normalizeNote(note = {}) {
  if (typeof note === 'string') {
    const body = note.trim();
    if (!body) throw new Error('Note body is required.');
    return { body, kind: 'curatorial' };
  }
  const body = text(note.body || note.text);
  if (!body) throw new Error('Note body is required.');
  return {
    body,
    kind: text(note.kind) || 'curatorial',
    author: text(note.author),
    created: note.created || new Date().toISOString()
  };
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}
