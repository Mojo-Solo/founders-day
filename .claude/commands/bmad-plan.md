# BMAD Planning Command

Automates BMAD (Build-Measure-Analyze-Decide) workflow for project planning and execution.

## Usage
```
/bmad-plan [project-name] [project-description]
```

## Process
The BMAD cycle includes:
1. **Build**: Generate PRD and architecture
2. **Measure**: Collect metrics and KPIs
3. **Analyze**: Evaluate performance and issues
4. **Decide**: Make data-driven improvements

## Example
```
/bmad-plan "e-commerce-platform" "Modern e-commerce platform with AI recommendations"
```

## Implementation
```bash
# Start BMAD cycle
claude-code task --subagent bmad-planner --prompt "Execute full BMAD cycle for project: $ARGUMENTS"
```

## Outputs
- Product Requirements Document (PRD)
- System Architecture Document
- Development Tasks
- Sprint Plans
- Success Metrics
- Decision Log

## Advanced Options
```
/bmad-plan [project] --phase build    # Run only build phase
/bmad-plan [project] --phase measure  # Run measurement phase
/bmad-plan [project] --phase analyze  # Run analysis phase
/bmad-plan [project] --phase decide   # Run decision phase
```

All artifacts are stored in MongoDB and can be retrieved for future reference.