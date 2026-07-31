import { Sparkles } from "lucide-react";

interface SkillDrawerProps {
  skills: string[];
}

export function SkillDrawer({ skills }: SkillDrawerProps) {
  return (
    <section className="panel skill-panel" aria-label="技能">
      <div className="panel-heading">
        <div>
          <h2>技能</h2>
          <p>精选技能包</p>
        </div>
        <Sparkles size={16} />
      </div>
      <ul className="skill-list">
        {skills.map((skill) => (
          <li key={skill}>{skill}</li>
        ))}
      </ul>
    </section>
  );
}
