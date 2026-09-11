'use client';

import { ErrorMessage, Field, Form, Formik } from 'formik';
import { CheckCircle2, Clock, UserPlus } from 'lucide-react';
import { useState } from 'react';
import * as Yup from 'yup';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { errorMessageOf } from '@/components/general/query-state';
import { useCustomToast } from '@/hooks/useCustomToast';
import {
  ALREADY_A_MEMBER_ERROR_CODE,
  ALREADY_HAS_ACTIVE_COMPANY_ERROR_CODE,
  ALREADY_INVITED_PENDING_ERROR_CODE,
  type InviteLogisticsMemberResult,
  type LogisticsMemberRole,
} from '@/interfaces/logistics';
import { useInviteLogisticsMember } from '@/services/logisticsMember.services';

type ContactMethod = 'email' | 'phone';

interface FormValues {
  contactMethod: ContactMethod;
  contactValue: string;
  name: string;
  role: LogisticsMemberRole;
}

const schema = Yup.object({
  contactMethod: Yup.string().oneOf(['email', 'phone']).required(),
  contactValue: Yup.string()
    .trim()
    .required('Enter an email or phone number.')
    .when('contactMethod', {
      is: 'email',
      then: (s) => s.email('Enter a valid email.'),
    }),
  name: Yup.string().trim(),
  role: Yup.string().oneOf(['ADMIN', 'OPERATOR']).required('Choose a role.'),
});

const INITIAL_VALUES: FormValues = {
  contactMethod: 'email',
  contactValue: '',
  name: '',
  role: 'OPERATOR',
};

/** Specific copy for the invite conflicts confirmed against `companyMember.service.ts`/`memberInvitation.service.ts`. */
const INVITE_ERROR_COPY: Record<string, string> = {
  [ALREADY_HAS_ACTIVE_COMPANY_ERROR_CODE]:
    'That person already has an active logistics company assignment elsewhere. Remove them from their current company first.',
  [ALREADY_A_MEMBER_ERROR_CODE]: 'That person already has a pending or active membership at this company.',
  [ALREADY_INVITED_PENDING_ERROR_CODE]: 'There is already a pending invitation for that address at this company.',
};

/**
 * Invite a POC to the caller's company.
 *
 * Renders one of two distinct success states rather than a generic "invited"
 * — `LINKED` (the address already belongs to a verified account) and
 * `PENDING` (it doesn't yet, and access appears automatically once they
 * sign up) mean genuinely different things for what the admin should do
 * next.
 *
 * `name` is a note for the ADMIN's own reference only — confirmed against
 * `companyMember.service.ts`, it is accepted by the API but never stored on
 * the resulting member row. Since the roster itself carries no display
 * information at all right now (see `interfaces/logistics.ts`), this is the
 * only place that name is ever visible again — shown back in the result
 * panel below, then gone. Worth being upfront about that in the label
 * rather than implying it's saved somewhere.
 */
export function InviteMemberDialog() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<InviteLogisticsMemberResult | null>(null);
  const [invitedName, setInvitedName] = useState('');
  const { showToast } = useCustomToast();
  const invite = useInviteLogisticsMember();

  const reset = () => {
    setResult(null);
    setInvitedName('');
    invite.reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="size-3.5" aria-hidden />
          Invite POC
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a POC</DialogTitle>
          <DialogDescription>
            Add a point of contact to your company. They sign in with their own Komtru account.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <InviteResultPanel
            result={result}
            name={invitedName}
            onDone={() => setOpen(false)}
            onInviteAnother={reset}
          />
        ) : (
          <Formik
            initialValues={INITIAL_VALUES}
            validationSchema={schema}
            onSubmit={({ contactMethod, contactValue, name, role }) => {
              const value = contactValue.trim();

              invite.mutate(
                {
                  email: contactMethod === 'email' ? value : undefined,
                  phone: contactMethod === 'phone' ? value : undefined,
                  name: name.trim() || undefined,
                  role,
                },
                {
                  onSuccess: (outcome) => {
                    setInvitedName(name.trim());
                    setResult(outcome);
                  },
                  onError: (error) => {
                    const specific = error.errorCode ? INVITE_ERROR_COPY[error.errorCode] : undefined;

                    showToast({
                      title: "Couldn't send the invite",
                      description: specific ?? errorMessageOf(error),
                      type: 'error',
                    });
                  },
                },
              );
            }}
          >
            {({ values, errors, touched, isValid, dirty, setFieldValue }) => (
              <Form className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="contactValue">Email or phone</Label>
                  <div className="flex gap-2">
                    <Select
                      value={values.contactMethod}
                      onValueChange={(value) => setFieldValue('contactMethod', value)}
                    >
                      <SelectTrigger className="w-28 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                      </SelectContent>
                    </Select>
                    <Field
                      as={Input}
                      id="contactValue"
                      name="contactValue"
                      type={values.contactMethod === 'email' ? 'email' : 'tel'}
                      placeholder={values.contactMethod === 'email' ? 'name@company.com' : '+234…'}
                      autoFocus
                    />
                  </div>
                  <ErrorMessage
                    name="contactValue"
                    render={(message) => (
                      <p className="text-komtru-risk text-[11.5px]" role="alert">
                        {message}
                      </p>
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="name">Name (optional)</Label>
                  <Field as={Input} id="name" name="name" placeholder="For your own reference" />
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Not saved anywhere after this — the roster doesn&apos;t show names yet, so jot this
                    down if you&apos;ll need to recognize them later.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={values.role}
                    onValueChange={(value) => setFieldValue('role', value)}
                  >
                    <SelectTrigger id="role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPERATOR">Operator — handles pickups</SelectItem>
                      <SelectItem value="ADMIN">Admin — manages the team</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-[11.5px] leading-relaxed">
                    Operators handle pickup requests and tracking. Admins can also manage the team.
                  </p>
                </div>

                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={invite.isPending || !(dirty && isValid)}
                    aria-invalid={Boolean(touched.contactValue && errors.contactValue)}
                  >
                    {invite.isPending ? 'Sending invite…' : 'Send invite'}
                  </Button>
                </DialogFooter>
              </Form>
            )}
          </Formik>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InviteResultPanel({
  result,
  name,
  onDone,
  onInviteAnother,
}: {
  result: InviteLogisticsMemberResult;
  name: string;
  onDone: () => void;
  onInviteAnother: () => void;
}) {
  const isLinked = result.outcome === 'LINKED';
  const who = name || 'This person';

  return (
    <div className="space-y-4">
      <div
        className={
          isLinked
            ? 'border-komtru-cyan/30 bg-komtru-cyan/10 flex items-start gap-3 rounded-lg border p-3'
            : 'border-komtru-gold/30 bg-komtru-gold/10 flex items-start gap-3 rounded-lg border p-3'
        }
      >
        {isLinked ? (
          <CheckCircle2 className="text-komtru-cyan mt-0.5 size-4 shrink-0" aria-hidden />
        ) : (
          <Clock className="text-komtru-gold mt-0.5 size-4 shrink-0" aria-hidden />
        )}
        <div className="space-y-1">
          <p className="text-sm font-semibold">
            {isLinked ? 'Added — they can log in now' : 'Pending'}
          </p>
          <p className="text-muted-foreground text-[12px] leading-relaxed">
            {isLinked
              ? `${who} already has a Komtru account. They'll get access the moment they sign in — let them know directly, since notifications aren't wired up yet.`
              : `${who} doesn't have a Komtru account yet, at ${result.invitation.contactMasked}. Access appears automatically once they sign up with that exact email or phone — let them know directly in the meantime, since notifications aren't wired up yet.`}
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onInviteAnother}>
          Invite another
        </Button>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </div>
  );
}
