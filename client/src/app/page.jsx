'use client';

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from '@/components/ui/Skeleton';


export default function RootPage() {
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.clear();
    navigate('/auth');
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Skeleton width="200px" height="40px" />
          <div className="flex gap-4">
            <Skeleton width="40px" height="40px" rounded="rounded-full" />
            <Skeleton width="120px" height="40px" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton height="160px" rounded="rounded-2xl" />
          <Skeleton height="160px" rounded="rounded-2xl" />
          <Skeleton height="160px" rounded="rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton height="400px" rounded="rounded-2xl" />
          <Skeleton height="400px" rounded="rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

