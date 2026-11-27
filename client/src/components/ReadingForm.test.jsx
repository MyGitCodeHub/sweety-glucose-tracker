import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../services/apiClient.js';
import { createReading, updateReading } from '../services/readingsService.js';
import { ReadingForm } from './ReadingForm.jsx';

vi.mock('../services/readingsService.js', () => ({
  createReading: vi.fn(),
  updateReading: vi.fn(),
}));

const FIXED_KOLKATA_NOW = new Date('2026-11-27T10:00:00.000Z'); // 15:30 IST on 2026-11-27
const TODAY_KOLKATA = '2026-11-27';
const TOMORROW_KOLKATA = '2026-11-28';

function renderReadingForm(props = {}) {
  const defaultProps = {
    isOpen: true,
    mode: 'create',
    initialReading: null,
    defaultDate: TODAY_KOLKATA,
    onClose: vi.fn(),
    onSaved: vi.fn(),
  };

  return {
    ...defaultProps,
    ...props,
    ...render(<ReadingForm {...defaultProps} {...props} />),
  };
}

describe('ReadingForm', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_KOLKATA_NOW);
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it('shows exact validation message when glucose value is empty', async () => {
    const user = userEvent.setup();
    renderReadingForm();

    await user.click(screen.getByRole('button', { name: 'Save reading' }));

    expect(await screen.findByText('Please enter a glucose value.')).toBeInTheDocument();
    expect(createReading).not.toHaveBeenCalled();
  });

  it('rejects glucose values below 40 (including 0) with the official range message', async () => {
    const user = userEvent.setup();
    renderReadingForm();

    const valueInput = screen.getByLabelText('Glucose value');
    await user.type(valueInput, '39');
    await user.click(screen.getByRole('button', { name: 'Save reading' }));

    expect(
      await screen.findByText('Value must be between 40 and 600 mg/dl.')
    ).toBeInTheDocument();

    await user.clear(valueInput);
    await user.type(valueInput, '0');
    await user.click(screen.getByRole('button', { name: 'Save reading' }));

    expect(
      await screen.findByText('Value must be between 40 and 600 mg/dl.')
    ).toBeInTheDocument();
    expect(createReading).not.toHaveBeenCalled();
  });

  it('rejects glucose values above 600 with the official range message', async () => {
    const user = userEvent.setup();
    renderReadingForm();

    await user.type(screen.getByLabelText('Glucose value'), '601');
    await user.click(screen.getByRole('button', { name: 'Save reading' }));

    expect(
      await screen.findByText('Value must be between 40 and 600 mg/dl.')
    ).toBeInTheDocument();
    expect(createReading).not.toHaveBeenCalled();
  });

  it('rejects fractional glucose values without silent truncation', async () => {
    const user = userEvent.setup();
    renderReadingForm();

    await user.type(screen.getByLabelText('Glucose value'), '120.5');
    await user.click(screen.getByRole('button', { name: 'Save reading' }));

    expect(
      await screen.findByText('Value must be between 40 and 600 mg/dl.')
    ).toBeInTheDocument();
    expect(createReading).not.toHaveBeenCalled();
  });

  it('rejects future dates evaluated against Asia/Kolkata today', async () => {
    const user = userEvent.setup();
    renderReadingForm();

    const dateInput = screen.getByLabelText('Date');
    await user.clear(dateInput);
    await user.type(dateInput, TOMORROW_KOLKATA);
    await user.type(screen.getByLabelText('Glucose value'), '115');
    await user.click(screen.getByRole('button', { name: 'Save reading' }));

    expect(await screen.findByText('Date cannot be in the future.')).toBeInTheDocument();
    expect(createReading).not.toHaveBeenCalled();
  });

  it('displays duplicate-slot API errors returned by the backend', async () => {
    const user = userEvent.setup();
    const message = 'You already have an After lunch reading for this date.';
    createReading.mockRejectedValueOnce(
      new ApiError(message, { status: 409, code: 'DUPLICATE_SLOT' })
    );

    const onSaved = vi.fn();
    renderReadingForm({ onSaved });

    await user.selectOptions(screen.getByLabelText('Time slot'), 'after_lunch');
    await user.type(screen.getByLabelText('Glucose value'), '145');
    await user.click(screen.getByRole('button', { name: 'Save reading' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('displays daily-limit API errors returned by the backend', async () => {
    const user = userEvent.setup();
    const message = 'You can add only 4 readings per day.';
    createReading.mockRejectedValueOnce(
      new ApiError(message, { status: 409, code: 'DAILY_LIMIT' })
    );

    const onSaved = vi.fn();
    renderReadingForm({ onSaved });

    await user.type(screen.getByLabelText('Glucose value'), '120');
    await user.click(screen.getByRole('button', { name: 'Save reading' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('submits a valid reading with an integer numeric payload and notifies onSaved', async () => {
    const user = userEvent.setup();
    const savedReading = {
      id: 101,
      date: TODAY_KOLKATA,
      slot: 'after_breakfast',
      value: 134,
    };
    createReading.mockResolvedValueOnce(savedReading);

    const onSaved = vi.fn();
    renderReadingForm({ onSaved });

    await user.selectOptions(screen.getByLabelText('Time slot'), 'after_breakfast');
    await user.type(screen.getByLabelText('Glucose value'), '134');
    await user.click(screen.getByRole('button', { name: 'Save reading' }));

    await waitFor(() => {
      expect(createReading).toHaveBeenCalledTimes(1);
    });
    expect(createReading).toHaveBeenCalledWith({
      date: TODAY_KOLKATA,
      slot: 'after_breakfast',
      value: 134,
    });
    expect(typeof createReading.mock.calls[0][0].value).toBe('number');
    expect(onSaved).toHaveBeenCalledWith(savedReading);
  });

  it('prefills existing date, slot, and value when opened in edit mode', () => {
    renderReadingForm({
      mode: 'edit',
      initialReading: {
        id: 42,
        date: '2026-11-25',
        slot: 'after_dinner',
        value: 128,
      },
    });

    expect(screen.getByRole('heading', { name: 'Edit reading' })).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toHaveValue('2026-11-25');
    expect(screen.getByLabelText('Time slot')).toHaveValue('after_dinner');
    expect(screen.getByLabelText('Glucose value')).toHaveValue('128');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('updates an existing reading with the correct ID and numeric payload', async () => {
    const user = userEvent.setup();
    const updatedReading = {
      id: 42,
      date: '2026-11-25',
      slot: 'after_lunch',
      value: 152,
    };
    updateReading.mockResolvedValueOnce(updatedReading);

    const onSaved = vi.fn();
    renderReadingForm({
      mode: 'edit',
      initialReading: {
        id: 42,
        date: '2026-11-25',
        slot: 'after_dinner',
        value: 128,
      },
      onSaved,
    });

    await user.selectOptions(screen.getByLabelText('Time slot'), 'after_lunch');
    const valueInput = screen.getByLabelText('Glucose value');
    await user.clear(valueInput);
    await user.type(valueInput, '152');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updateReading).toHaveBeenCalledTimes(1);
    });
    expect(updateReading).toHaveBeenCalledWith(42, {
      date: '2026-11-25',
      slot: 'after_lunch',
      value: 152,
    });
    expect(onSaved).toHaveBeenCalledWith(updatedReading);
  });

  it('preserves user-entered values when submission fails', async () => {
    const user = userEvent.setup();
    const message = 'You already have an After lunch reading for this date.';
    createReading.mockRejectedValueOnce(
      new ApiError(message, { status: 409, code: 'DUPLICATE_SLOT' })
    );

    const onClose = vi.fn();
    const onSaved = vi.fn();
    renderReadingForm({ onClose, onSaved });

    const dateInput = screen.getByLabelText('Date');
    const slotSelect = screen.getByLabelText('Time slot');
    const valueInput = screen.getByLabelText('Glucose value');

    await user.clear(dateInput);
    await user.type(dateInput, '2026-11-26');
    await user.selectOptions(slotSelect, 'after_lunch');
    await user.type(valueInput, '148');
    await user.click(screen.getByRole('button', { name: 'Save reading' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(dateInput).toHaveValue('2026-11-26');
    expect(slotSelect).toHaveValue('after_lunch');
    expect(valueInput).toHaveValue('148');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('disables controls and prevents duplicate requests while submission is pending', async () => {
    const user = userEvent.setup();
    let resolveCreate;
    createReading.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );

    const onSaved = vi.fn();
    renderReadingForm({ onSaved });

    await user.type(screen.getByLabelText('Glucose value'), '118');
    const submitButton = screen.getByRole('button', { name: 'Save reading' });
    await user.click(submitButton);

    const savingButton = screen.getByRole('button', { name: 'Saving...' });
    expect(savingButton).toBeDisabled();
    expect(screen.getByLabelText('Date')).toBeDisabled();
    expect(screen.getByLabelText('Time slot')).toBeDisabled();
    expect(screen.getByLabelText('Glucose value')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeDisabled();

    await user.click(savingButton);
    expect(createReading).toHaveBeenCalledTimes(1);

    const resolvedReading = {
      id: 205,
      date: TODAY_KOLKATA,
      slot: 'morning_fasting',
      value: 118,
    };
    resolveCreate(resolvedReading);

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(resolvedReading);
    });
  });
});
