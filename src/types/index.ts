export type Categoria = 'Amateur' | 'Open';
export type Rol = 'Leader' | 'Follower';
export type Fase = 'Preliminar' | 'Semifinal' | 'Final';

export interface Competidor {
    id: number;
    dorsal: string;
    nombre: string;
    categoria: Categoria;
    rol: Rol;
}

// Así es como el backend nos devuelve los competidores agrupados
export interface GroupedCompetitors {
    Amateur: {
        Leaders: Competidor[];
        Followers: Competidor[];
    };
    Open: {
        Leaders: Competidor[];
        Followers: Competidor[];
    };
}