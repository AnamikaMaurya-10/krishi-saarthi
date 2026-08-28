export type Role = "farmer" | "officer";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  farmerId?: string;
}

export interface Farmer {
  id: string;
  userId: string;
  name: string;
  village: string;
  district: string;
  state: string;
  crop: string;
  landAcres: number;
  irrigation: string;
  soilType: string;
  language: string;
  phone: string;
  loanDueDate: string;
  concern: string;
  createdAt: string;
}

export interface Intervention {
  id: string;
  farmerId: string;
  officerId: string;
  action: string;
  note: string;
  status: "pending" | "contacted" | "resolved";
  createdAt: string;
}

export interface Db {
  users: User[];
  farmers: Farmer[];
  interventions: Intervention[];
}
