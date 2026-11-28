import { HostError, ERR } from '../../../contract/host/host-bridge';

const LIBRARY = [
  { id: 'itm_sim001', type: 'article-journal', title: 'Attention Is All You Need', author: 'Vaswani, Shazeer, Parmar', year: 2017, doi: '10.48550/arXiv.1706.03762' },
  { id: 'itm_sim002', type: 'book', title: 'The Structure of Scientific Revolutions', author: 'Kuhn', year: 1962, isbn: '9780226458083' },
  { id: 'itm_sim003', type: 'article-journal', title: 'A Mathematical Theory of Communication', author: 'Shannon', year: 1948, doi: '10.1002/j.1538-7305.1948.tb01338.x' },
  { id: 'itm_sim004', type: 'article-journal', title: 'Deep Residual Learning for Image Recognition', author: 'He, Zhang, Ren, Sun', year: 2016, doi: '10.1109/CVPR.2016.90' },
  { id: 'itm_sim005', type: 'book', title: 'Thinking, Fast and Slow', author: 'Kahneman', year: 2011, isbn: '9780374275631' },
];

export const OLDER_HOST_KEY = 'formext.sim.olderHost';

export function olderHost(): boolean {
  try {
    return localStorage.getItem(OLDER_HOST_KEY) === '1';
  } catch {
    return false;
  }
}

function cite(ids: unknown) {
  const list = Array.isArray(ids) ? ids.map(String) : [];
  const found = LIBRARY.filter((i) => list.includes(i.id));
  if (!found.length) throw new HostError(ERR.REFUSED, 'None of these items are in the library.');
  return found;
}

export async function simService(service: string, method: string, params: Record<string, unknown>): Promise<unknown> {
  if (service !== 'formcite') throw new HostError(ERR.INVALID, `${service} is not a family service`);
  switch (method) {
    case 'search': {
      const q = String(params.q ?? '').trim().toLowerCase();
      if (!q) throw new HostError(ERR.REFUSED, 'q must not be empty');
      const hits = LIBRARY.filter((i) => `${i.title} ${i.author} ${i.year}`.toLowerCase().includes(q));
      const offset = Math.max(0, Number(params.offset ?? 0));
      const limit = Math.max(1, Number(params.limit ?? 25));
      return { query: q, total: hits.length, items: hits.slice(offset, offset + limit), simulated: true };
    }
    case 'get': {
      const item = LIBRARY.find((i) => i.id === params.id);
      if (!item) throw new HostError(ERR.REFUSED, 'There is no item with this id.');
      return item;
    }
    case 'cite':
      return { style: String(params.style ?? ''), text: `(${cite(params.ids).map((i) => `${i.author.split(',')[0]} ${i.year}`).join('; ')})`, simulated: true };
    case 'bibliography':
      return { style: String(params.style ?? ''), entries: cite(params.ids).map((i) => `${i.author} (${i.year}). ${i.title}.`), simulated: true };
    case 'add':
    case 'import':
      return { added: [], skipped: [], simulated: true, detail: 'The simulated FormCite keeps its library unchanged.' };
  }
  throw new HostError(ERR.INVALID, `FormCite does not accept ${method}`);
}
