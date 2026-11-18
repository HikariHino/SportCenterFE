# Backend support for 400-character Coach prompts

The Coach form accepts a prompt up to 400 characters. The request uses the existing
`POST /api/ai/workout-recommendations` contract: `memberId`, `goal`, `level`,
`daysPerWeek`. The `goal` field includes the complete prompt, selected goal,
start date, end date, sport and available exercise names, up to 1000 characters.
The frontend does not truncate the prompt or discard the dates or selected goal.

As checked on 18 November 2026, the deployed API advertises `goal.maxLength: 200`.
The backend repository also limits the request and saved history to 200. Longer
requests require the backend changes below before they can succeed in production.
These changes have not been applied to the backend or database from this repository.

## Backend changes

In `DTOs/AI/AiDTOs.cs`, replace the annotation on `WorkoutAiRequest.Goal`:

```csharp
[StringLength(1000, ErrorMessage = "Mục tiêu tập luyện tối đa 1000 ký tự.")]
public string? Goal { get; set; }
```

In `Models/AIWorkoutHistory.cs`, update the saved history field:

```csharp
[MaxLength(1000)]
public string Goal { get; set; } = string.Empty;
```

Generate and apply an EF migration for the updated column and model snapshot:

```sh
dotnet ef migrations add ExpandAIWorkoutGoalLength
dotnet ef database update
```

The equivalent PostgreSQL column expansion is:

```sql
ALTER TABLE "AIWorkoutHistories"
  ALTER COLUMN "Goal" TYPE character varying(1000);
```

Use the project's migration deployment workflow to keep migration history and the
model snapshot consistent. Deploy the updated backend and verify Swagger advertises
1000 characters. Test a 400-character prompt plus goal and dates, confirm the
structured response still contains sessions, and read the saved history back.

References:

- [Workout request DTO](https://github.com/phcgnguyen19/SportsCenterBE/blob/master/DTOs/AI/AiDTOs.cs#L11)
- [Workout history model](https://github.com/phcgnguyen19/SportsCenterBE/blob/master/Models/AIWorkoutHistory.cs)
- [Existing table definition](https://github.com/phcgnguyen19/SportsCenterBE/blob/master/docs/sql/AddAIWorkoutHistory.sql)
