"""Report per-run prediction rates for historical twin scenarios."""
from pathlib import Path
import pandas as pd

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'historical_proportional'
SCENARIOS={
    '01-norm-flashcrowd':('норма','flash-crowd'),
    '21-attack-flood':('атака','флуд'),
    '25-attack-lowflood':('атака','слабый флуд'),
    '14-fault-authfail':('сбой','ошибки авторизации'),
    '20-attack-bruteforce':('атака','перебор'),
    '23-attack-lowbrute':('атака','медленный перебор')}


def main():
    p=pd.read_csv(OUT/'predictions.csv.gz')
    p=p[(p.fraction==1)&(~p.temporal)&p.scenario.isin(SCENARIOS)&
        p.model.isin(('rf','mlp','transformer'))].copy()
    p['is_attack']=(p.prediction=='attack').astype(float)
    # Average overlapping windows within run first; then runs, seeds, and split.
    run=p.groupby(['scenario','model','split','seed','run_id'],as_index=False).is_attack.mean()
    seed=run.groupby(['scenario','model','split','seed'],as_index=False).is_attack.mean()
    split=seed.groupby(['scenario','model','split'],as_index=False).is_attack.mean()
    summary=split.groupby(['scenario','model']).is_attack.agg(['mean','std','count']).reset_index()
    counts=p.groupby('scenario').run_id.nunique().to_dict()
    summary['unique_test_runs']=summary.scenario.map(counts)
    summary.to_csv(OUT/'twin_run_summary.csv',index=False)
    lines=['# Исторические пары похожих сценариев','',
      'Средняя доля окон с прогнозом «атака» ± стандартное отклонение по пяти разделениям. '
      'Сначала усредняются перекрывающиеся окна внутри каждого прогона, затем прогоны, seed и разделения. '
      'Один прогон может попадать в несколько тестовых разделений. Для нормы и сбоя высокий показатель '
      'означает ложные тревоги, для атак — обнаружение в этом наборе.', '',
      '| Сценарий | Метка | Разных test-прогонов | RF | MLP | Transformer |',
      '|---|---|---:|---:|---:|---:|']
    for scenario,(label,title) in SCENARIOS.items():
        values=[]
        for model in ('rf','mlp','transformer'):
            row=summary[(summary.scenario==scenario)&(summary.model==model)].iloc[0]
            values.append(f'{row["mean"]:.3f} ± {row["std"]:.3f}')
        lines.append(f'| {title} | {label} | {counts[scenario]} | '+' | '.join(values)+' |')
    lines+=['','Исторические метки воздействия и временные отсчёты независимо не подтверждены. '
      'Для flash-crowd и флуда исходные endpoint различаются; высокая точность может отражать различия сценариев. '
      'Интервал `rate()` не учитывался при первичной фильтрации, а после строгой фильтрации authfail отсутствует. '
      'Разделения и seed не являются независимыми внешними наборами.','',
      'Подробные прогнозы: `historical_proportional/predictions.csv.gz`; '
      'сводка по разбиениям: `historical_proportional/twin_run_summary.csv`. '
      'Для повторения: `python research/ml/report_historical_twins.py`.']
    (ROOT/'HISTORICAL_TWINS.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
    print('\n'.join(lines))


if __name__=='__main__':main()
