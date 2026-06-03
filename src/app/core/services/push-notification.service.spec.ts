import { TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PushNotificationService } from './push-notification.service';
import { SupabaseService } from './supabase.service';

// ---------------------------------------------------------------------------
// Shared test doubles
// ---------------------------------------------------------------------------

function makeMockSubscription() {
  return { toJSON: vi.fn().mockReturnValue({ endpoint: 'https://push.example.com' }) };
}

function makeMockRegistration(subscription = makeMockSubscription()) {
  return {
    pushManager: {
      subscribe: vi.fn().mockResolvedValue(subscription),
    },
  };
}

function makeSupabaseMock(opts: { pushSubscription?: unknown; session?: unknown } = {}) {
  const session = opts.session !== undefined ? opts.session : { user: { id: 'user-1' } };

  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const updateChain = { eq: updateEq };
  const update = vi.fn().mockReturnValue(updateChain);

  const singleResult = {
    data: { push_subscription: opts.pushSubscription ?? null },
    error: null,
  };
  const selectSingle = vi.fn().mockResolvedValue(singleResult);
  const selectEq = vi.fn().mockReturnValue({ single: selectSingle });
  const select = vi.fn().mockReturnValue({ eq: selectEq });

  const from = vi.fn().mockReturnValue({ select, update });

  return {
    sessionReady: Promise.resolve(),
    getSession: vi.fn().mockResolvedValue(session),
    client: { from },
    _spies: { from, select, update, updateEq },
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('PushNotificationService', () => {
  let service: PushNotificationService;
  let supabaseMock: ReturnType<typeof makeSupabaseMock>;

  // Save originals so we can restore them after each test
  const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
  const originalNotification = (globalThis as Record<string, unknown>)['Notification'];

  function stubSwApis(registrations: unknown[], registration = makeMockRegistration()) {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistrations: vi.fn().mockResolvedValue(registrations),
        ready: Promise.resolve(registration),
      },
    });
    Object.defineProperty(window, 'PushManager', {
      configurable: true,
      value: class {},
    });
  }

  function stubNotificationPermission(permission: NotificationPermission) {
    (globalThis as Record<string, unknown>)['Notification'] = {
      requestPermission: vi.fn().mockResolvedValue(permission),
    };
  }

  beforeEach(async () => {
    supabaseMock = makeSupabaseMock();

    await TestBed.configureTestingModule({
      providers: [PushNotificationService, { provide: SupabaseService, useValue: supabaseMock }],
    }).compileComponents();

    service = TestBed.inject(PushNotificationService);
    TestBed.inject(ApplicationRef).tick();
  });

  afterEach(() => {
    // Restore navigator.serviceWorker
    if (originalServiceWorker) {
      Object.defineProperty(navigator, 'serviceWorker', originalServiceWorker);
    } else {
      delete (navigator as unknown as Record<string, unknown>)['serviceWorker'];
    }
    // Restore Notification
    (globalThis as Record<string, unknown>)['Notification'] = originalNotification;
    vi.restoreAllMocks();
  });

  it('exits silently when serviceWorker is not in navigator', async () => {
    delete (navigator as unknown as Record<string, unknown>)['serviceWorker'];

    await service.initializePush();

    expect(supabaseMock.getSession).not.toHaveBeenCalled();
  });

  it('exits silently when no service worker registrations exist', async () => {
    stubSwApis([]); // empty registrations

    await service.initializePush();

    expect(supabaseMock.getSession).not.toHaveBeenCalled();
  });

  it('exits silently when there is no active session', async () => {
    supabaseMock.getSession.mockResolvedValue(null);

    stubSwApis([makeMockRegistration()]);

    await service.initializePush();

    expect(supabaseMock._spies.from).not.toHaveBeenCalled();
  });

  it('exits silently when the profile already has a push_subscription', async () => {
    supabaseMock._spies.select.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { push_subscription: { endpoint: 'https://existing.example.com' } },
          error: null,
        }),
      }),
    });

    stubSwApis([makeMockRegistration()]);
    stubNotificationPermission('granted');

    await service.initializePush();

    // select was called to check existing subscription, but update must NOT be called
    expect(supabaseMock._spies.update).not.toHaveBeenCalled();
  });

  it('exits silently when the user denies notification permission', async () => {
    stubSwApis([makeMockRegistration()]);
    stubNotificationPermission('denied');

    await service.initializePush();

    expect(supabaseMock._spies.update).not.toHaveBeenCalled();
  });

  it('subscribes and persists the subscription when all conditions are met', async () => {
    const mockSub = makeMockSubscription();
    const mockReg = makeMockRegistration(mockSub);

    stubSwApis([mockReg], mockReg);
    stubNotificationPermission('granted');

    await service.initializePush();

    expect(mockReg.pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    });
    expect(supabaseMock._spies.update).toHaveBeenCalledWith({
      push_subscription: { endpoint: 'https://push.example.com' },
    });
    expect(supabaseMock._spies.updateEq).toHaveBeenCalledWith('id', 'user-1');
  });
});
