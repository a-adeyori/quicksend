import { api } from './apiClient';

export interface Contact {
  id: string;
  name: string;
  initials: string;
  color: string;
  walletAddress: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export const contactsService = {
  async list(): Promise<Contact[]> {
    const { data } = await api.get<Contact[]>('/contacts');
    return data;
  },

  async create(params: Omit<Contact, 'id' | 'initials'> & { initials?: string }): Promise<Contact> {
    const { data } = await api.post<Contact>('/contacts', params);
    return data;
  },

  async update(id: string, params: Partial<Contact>): Promise<Contact> {
    const { data } = await api.put<Contact>(`/contacts/${id}`, params);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/contacts/${id}`);
  },
};
