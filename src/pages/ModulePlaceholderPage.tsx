import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Construction, ArrowLeft, BookOpen, Layers } from 'lucide-react';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

export interface ModulePlaceholderProps {
  moduleName: string;
  category: string;
  description: string;
  targetPrompt: string;
  businessCapabilities: string[];
}

export const ModulePlaceholderPage: React.FC<ModulePlaceholderProps> = ({
  moduleName,
  category,
  description,
  targetPrompt,
  businessCapabilities,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'StructStock', onClick: () => navigate('/dashboard') },
        { label: category },
        { label: moduleName, active: true },
      ]}
      title={moduleName}
      description={description}
      badge={<Badge variant="warning">Scheduled: {targetPrompt}</Badge>}
      actions={
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button
            variant="secondary"
            icon={<ArrowLeft size={16} />}
            onClick={() => navigate('/dashboard')}
          >
            Back to Dashboard
          </Button>
          <Button
            variant="primary"
            icon={<BookOpen size={16} />}
            onClick={() => navigate('/architecture')}
          >
            System Architecture
          </Button>
        </div>
      }
    >
      <Card style={{ marginTop: 'var(--space-4)' }}>
        <div
          style={{
            padding: 'var(--space-8) var(--space-6)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxWidth: 640,
            margin: '0 auto',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--radius-xl)',
              backgroundColor: 'var(--color-orange-100)',
              color: 'var(--color-orange-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 'var(--space-4)',
            }}
          >
            <Construction size={28} />
          </div>

          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-charcoal-900)' }}>
            {moduleName} Module
          </h2>

          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)', lineHeight: 1.6 }}>
            {description}
          </p>

          <div
            style={{
              marginTop: 'var(--space-5)',
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-bg-subtle)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              width: '100%',
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-charcoal-700)', marginBottom: 'var(--space-2)' }}>
              Target Business Capabilities:
            </div>
            <ul style={{ listStyle: 'disc', paddingLeft: 'var(--space-4)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {businessCapabilities.map((cap, i) => (
                <li key={i}>{cap}</li>
              ))}
            </ul>
          </div>

          <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)' }}>
            <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/users')}>
              Manage Users & Permissions
            </Button>
          </div>
        </div>
      </Card>
    </AppLayout>
  );
};
