import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { resumeService } from '@/services/resume.service';

export const useGenerateResume = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => resumeService.generateResume(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-resumes'] });
      qc.invalidateQueries({ queryKey: ['resume-stats'] });
      toast.success('Resume generated successfully!');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to generate resume'),
  });
};

export const useMyResumes = (params) =>
  useQuery({
    queryKey: ['my-resumes', params],
    queryFn: () => resumeService.getMyResumes(params).then(r => r.data),
  });

export const useResume = (resumeId) =>
  useQuery({
    queryKey: ['resume', resumeId],
    queryFn: () => resumeService.getResume(resumeId).then(r => r.data),
    enabled: !!resumeId,
  });

export const useResumeTemplates = () =>
  useQuery({
    queryKey: ['resume-templates'],
    queryFn: () => resumeService.getTemplates().then(r => r.data),
    staleTime: 1000 * 60 * 60,
  });

export const useResumeStats = () =>
  useQuery({
    queryKey: ['resume-stats'],
    queryFn: () => resumeService.getStats().then(r => r.data),
  });

export const useDeleteResume = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (resumeId) => resumeService.deleteResume(resumeId),
    onSuccess: () => {
      toast.success('Resume deleted');
      qc.invalidateQueries({ queryKey: ['my-resumes'] });
      qc.invalidateQueries({ queryKey: ['resume-stats'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete resume'),
  });
};

export const useDownloadResume = () => {
  return useMutation({
    mutationFn: async (resumeId) => {
      const response = await resumeService.downloadResume(resumeId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Resume.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return response;
    },
    onSuccess: () => toast.success('Resume downloaded!'),
    onError: (err) => toast.error('Failed to download resume'),
  });
};
