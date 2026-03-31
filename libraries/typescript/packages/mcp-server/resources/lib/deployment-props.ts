import { z } from "zod";

/** Serialized API payload for organization widget */
export const organizationPropsSchema = z.object({
  organization: z
    .object({
      id: z.string(),
      profile_name: z.string(),
      slug: z.string().nullable().optional(),
      role: z.string().nullable().optional(),
    })
    .passthrough(),
});

export type OrganizationWidgetProps = z.infer<typeof organizationPropsSchema>;

/** Serialized API payload for single deployment */
export const deploymentRecordSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    status: z.string().optional(),
    domain: z.string().optional(),
    customDomain: z.string().optional(),
    source: z
      .object({
        type: z.string().optional(),
        repo: z.string().optional(),
        branch: z.string().optional(),
        rootDir: z.string().optional(),
        runtime: z.string().optional(),
        port: z.number().optional(),
        startCommand: z.string().optional(),
        buildCommand: z.string().optional(),
      })
      .passthrough()
      .optional(),
    gitBranch: z.string().optional(),
    gitCommitSha: z.string().optional(),
    gitCommitMessage: z.string().optional(),
    serverId: z.string().optional(),
    serverSlug: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    error: z.string().optional(),
    provider: z.string().optional(),
    appName: z.string().optional(),
  })
  .passthrough();

export const deploymentDetailPropsSchema = z.object({
  deployment: deploymentRecordSchema,
});

export type DeploymentDetailWidgetProps = z.infer<
  typeof deploymentDetailPropsSchema
>;
