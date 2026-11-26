import { api } from "./api";

export interface AddressResponseDto {
  id: string;
  label: string;
  addressText: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  createdAt: string;
}

export interface CreateAddressRequestDto {
  label: string;
  addressText: string;
  latitude: number;
  longitude: number;
  isDefault?: boolean;
}

export type UpdateAddressRequestDto = Partial<CreateAddressRequestDto>;

export const addressService = {
  async list(): Promise<AddressResponseDto[]> {
    const { data } = await api.get<AddressResponseDto[]>("/addresses");
    return data;
  },

  async create(payload: CreateAddressRequestDto): Promise<AddressResponseDto> {
    const { data } = await api.post<AddressResponseDto>("/addresses", payload);
    return data;
  },

  async update(id: string, payload: UpdateAddressRequestDto): Promise<AddressResponseDto> {
    const { data } = await api.patch<AddressResponseDto>(`/addresses/${id}`, payload);
    return data;
  },

  async setDefault(id: string): Promise<AddressResponseDto> {
    const { data } = await api.patch<AddressResponseDto>(`/addresses/${id}/default`);
    return data;
  },

  async remove(id: string): Promise<{ message?: string; success?: boolean }> {
    const { data } = await api.delete<{ message?: string; success?: boolean }>(`/addresses/${id}`);
    return data;
  },
};
