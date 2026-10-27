import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'StructStock', onClick: () => navigate('/dashboard') },
        { label: '404 Page Not Found', active: true },
      ]}
      title="404 — Destination Not Found"
      description="The requested URL route does not exist or may have been relocated."
    >
      <Card style={{ marginTop: 'var(--space-4)' }}>
        <div
          style={{
            padding: 'var(--space-10) var(--space-6)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxWidth: 480,
            margin: '0 auto',
            gap: 'var(--space-3)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              backgroundColor: 'var(--color-charcoal-200)',
              color: 'var(--color-charcoal-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FileQuestion size={28} />
          </div>

          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-charcoal-900)' }}>
            Route Not Recognized
          </h2>

          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-subtle)' }}>
            Please check the web address or return to your authorized project stock dashboard.
          </p>

          <Button
            variant="primary"
            icon={<ArrowLeft size={16} />}
            onClick={() => navigate('/dashboard')}
            style={{ marginTop: 'var(--space-2)' }}
          >
            Return to Dashboard
          </Button>
        </div>
      </Card>
    </AppLayout>
  );
};
