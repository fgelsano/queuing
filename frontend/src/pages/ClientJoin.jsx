import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { saveQueueEntry } from '../utils/queueStorage';
import Input from '../components/Input';
import Button from '../components/Button';
import Loading from '../components/Loading';
import Logo from '../components/Logo';

const CLIENT_TYPES = [
  { value: 'REGULAR', label: 'Regular' },
  { value: 'SENIOR_CITIZEN', label: 'Senior Citizen' },
  { value: 'PWD', label: 'PWD' },
  { value: 'PREGNANT', label: 'Pregnant' },
];

export default function ClientJoin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    clientName: '',
    clientType: 'REGULAR',
    categoryIds: [],
    subCategoryIds: [],
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(Array.isArray(res.data?.categories) ? res.data.categories : []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  // Subcategories from ALL selected categories
  const availableSubCategories = useMemo(() => {
    if (!formData.categoryIds?.length) return [];
    const selected = (categories || []).filter((c) => formData.categoryIds.includes(c.id));
    const subs = new Map();
    selected.forEach((cat) => {
      (cat.subCategories || []).forEach((sub) => {
        if (!subs.has(sub.id)) subs.set(sub.id, { ...sub, categoryName: cat.name });
      });
    });
    return Array.from(subs.values());
  }, [formData.categoryIds, categories]);

  const toggleCategory = (categoryId) => {
    const ids = formData.categoryIds || [];
    const next = ids.includes(categoryId)
      ? ids.filter((id) => id !== categoryId)
      : [...ids, categoryId];
    // Build subcategories that will still be available after this change
    const catsAfter = (categories || []).filter((c) => next.includes(c.id));
    const validSubIds = new Set();
    catsAfter.forEach((cat) => {
      (cat.subCategories || []).forEach((s) => validSubIds.add(s.id));
    });
    setFormData({
      ...formData,
      categoryIds: next,
      subCategoryIds: (formData.subCategoryIds || []).filter((subId) => validSubIds.has(subId)),
    });
  };

  const toggleSubCategory = (subCategoryId) => {
    const ids = formData.subCategoryIds || [];
    const next = ids.includes(subCategoryId)
      ? ids.filter((id) => id !== subCategoryId)
      : [...ids, subCategoryId];
    setFormData({ ...formData, subCategoryIds: next });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    const newErrors = {};
    if (!formData.clientName.trim()) newErrors.clientName = 'Name is required';
    if (!formData.categoryIds?.length) newErrors.categoryId = 'Select at least one category';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);

    try {
      const res = await api.post('/queue/join', {
        clientName: formData.clientName.trim(),
        clientType: formData.clientType,
        categoryIds: formData.categoryIds,
        subCategoryIds: formData.subCategoryIds?.length ? formData.subCategoryIds : undefined,
      });

      const entry = res.data.queueEntry;
      const categoryNames = (entry.concernCategories || [entry.category]).map((c) => c.name).join(', ');
      const subNames = (entry.concernSubCategories || []).map((s) => s.name).join(', ') || null;

      saveQueueEntry({
        queueNumber: entry.queueNumber,
        clientName: entry.clientName,
        date: entry.date,
        category: categoryNames,
        subCategory: subNames,
        clientType: entry.clientType,
        status: entry.status,
      });

      navigate('/success');
    } catch (error) {
      console.error('Failed to join queue:', error);
      setErrors({ submit: error.response?.data?.error || 'Failed to join queue' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loading />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
          <Logo size="medium" />
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px', color: '#1e293b', textAlign: 'center' }}>
          Join Queue
        </h1>
        <p style={{ fontSize: '14px', color: '#64748b', textAlign: 'center', marginBottom: '32px' }}>
          Fill in your details to get a queue number
        </p>

        <form onSubmit={handleSubmit}>
          <Input
            label="Your Name"
            value={formData.clientName}
            onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
            error={errors.clientName}
            placeholder="Enter your full name"
            required
          />

          {/* Client Type - pill radio */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#1e293b' }}>
              Client Type
            </label>
            <div className="client-type-pills">
              {CLIENT_TYPES.map(({ value, label }) => (
                <label
                  key={value}
                  className={`pill-radio ${formData.clientType === value ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="clientType"
                    value={value}
                    checked={formData.clientType === value}
                    onChange={() => setFormData({ ...formData, clientType: value })}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Concern Categories - checkboxes */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#1e293b' }}>
              Concern Category <span style={{ color: '#ef4444' }}>*</span>
            </label>
            {errors.categoryId && (
              <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '8px' }}>{errors.categoryId}</div>
            )}
            <div className="checkbox-group">
              {(categories || []).map((cat) => (
                <label key={cat.id} className={`checkbox-row ${(formData.categoryIds || []).includes(cat.id) ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={(formData.categoryIds || []).includes(cat.id)}
                    onChange={() => toggleCategory(cat.id)}
                  />
                  <span className="checkmark" />
                  <span>{cat.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Sub-Concerns - checkboxes (from selected categories) */}
          {availableSubCategories.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#1e293b' }}>
                Sub-Concern (Optional)
              </label>
              <div className="checkbox-group">
                {availableSubCategories.map((sub) => (
                  <label key={sub.id} className={`checkbox-row ${(formData.subCategoryIds || []).includes(sub.id) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={(formData.subCategoryIds || []).includes(sub.id)}
                      onChange={() => toggleSubCategory(sub.id)}
                    />
                    <span className="checkmark" />
                    <span>{sub.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {errors.submit && (
            <div style={{
              padding: '12px',
              background: '#fee2e2',
              color: '#991b1b',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '14px',
            }}>
              {errors.submit}
            </div>
          )}

          <Button
            type="submit"
            variant="gradient"
            fullWidth
            disabled={submitting}
            style={{ marginTop: '8px', padding: '14px 24px', fontSize: '16px' }}
          >
            {submitting ? 'Joining...' : 'Join Queue'}
          </Button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <a href="/monitor" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '14px' }}>
            View Queue Status →
          </a>
        </div>
      </div>
    </div>
  );
}
