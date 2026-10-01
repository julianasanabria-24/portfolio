// Tipos para los proyectos. El contenido se edita en projects.json.
import data from './projects.json';

export type Category = string;

export interface Slide {
  kicker: string;
  title: string;
  text: string;
  image?: string;
}

export interface Project {
  slug: string;
  title: string;
  summary: string;
  year: string;
  categories: Category[];
  featured: boolean;
  color: string;
  image?: string;
  result: string;
  slides: Slide[];
}

export const categories: Category[] = data.categories;
export const projects: Project[] = data.projects;
