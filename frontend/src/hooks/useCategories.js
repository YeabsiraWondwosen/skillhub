import { useQuery } from '@tanstack/react-query';
import { categoryService } from '@/services/category.service';

export const categoryKeys = {
  all: ['categories'],
  list: () => ['categories', 'list'],
  detail: (id) => ['categories', id],
  skills: (id) => ['categories', id, 'skills'],
  subcategories: (id) => ['categories', id, 'subcategories'],
  adminList: (params) => ['categories', 'admin', params],
  adminStats: ['categories', 'admin', 'stats'],
};

export const useCategories = () =>
  useQuery({
    queryKey: categoryKeys.list(),
    queryFn: () => categoryService.getCategories().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

export const useCategory = (id) =>
  useQuery({
    queryKey: categoryKeys.detail(id),
    queryFn: () => categoryService.getCategory(id).then(r => r.data),
    enabled: !!id,
  });

export const useSkillsByCategory = (id) =>
  useQuery({
    queryKey: categoryKeys.skills(id),
    queryFn: () => categoryService.getSkillsByCategory(id).then(r => r.data),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

export const useSubcategoriesByCategory = (id) =>
  useQuery({
    queryKey: categoryKeys.subcategories(id),
    queryFn: () => categoryService.getSubcategoriesByCategory(id).then(r => r.data),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

export const useCategoryTree = () =>
  useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: () => categoryService.getCategoryTree().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
